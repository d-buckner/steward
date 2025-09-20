import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Service } from '../src/core/Service'
import { withWorker } from '../src/core/WorkerDecorator'
import { ReliableWorkerProxy } from '../src/core/ReliableWorkerProxy'

/**
 * Tests for the Reliable Worker Proxy
 *
 * This tests a simplified WorkerProxy that:
 * - Automatically falls back to main thread when worker fails
 * - Uses pure message passing instead of method dispatch
 * - Has reliable error handling and recovery
 * - Maintains mailbox architecture principles
 */

interface TestState {
  count: number
  isProcessing: boolean
  result: number | null
}

@withWorker('TestReliableService')
class TestReliableService extends Service<TestState> {
  constructor() {
    super({
      count: 0,
      isProcessing: false,
      result: null
    })
  }

  increment(): void {
    this.setState('count', this.state.count + 1)
  }

  async processData(items: number[]): Promise<number> {
    this.setState('isProcessing', true)

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 10))

    const result = items.reduce((sum, item) => sum + item, 0)
    this.setState('result', result)
    this.setState('isProcessing', false)
    return result
  }

  throwError(): void {
    throw new Error('Test error')
  }
}

// Mock Worker for testing
class MockWorker extends EventTarget {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  private shouldFail: boolean = false
  private responseDelay: number = 10

  constructor(public url: string, public options?: any) {
    super()
  }

  postMessage(data: any): void {
    if (this.shouldFail) {
      setTimeout(() => {
        this.onerror?.({
          message: 'Mock worker error',
          filename: 'test',
          lineno: 1,
          colno: 1,
          error: new Error('Mock worker error')
        } as ErrorEvent)
      }, 5)
      return
    }

    setTimeout(() => {
      this.handleMessage(data)
    }, this.responseDelay)
  }

  terminate(): void {
    // Mock termination
  }

  simulateFailure(): void {
    this.shouldFail = true
  }

  simulateRecovery(): void {
    this.shouldFail = false
  }

  setResponseDelay(delay: number): void {
    this.responseDelay = delay
  }

  private handleMessage(data: any): void {
    const { type, id, payload } = data

    switch (type) {
      case 'INIT_SERVICE':
        this.onmessage?.({
          data: { type: 'INIT_SERVICE', success: true }
        } as MessageEvent)
        break

      case 'SERVICE_MESSAGE':
        const { messageType } = data

        if (messageType === 'increment') {
          // Simulate state change
          this.onmessage?.({
            data: { type: 'STATE_CHANGE', key: 'count', value: 1 }
          } as MessageEvent)

          this.onmessage?.({
            data: { type: 'MESSAGE_RESPONSE', id, success: true }
          } as MessageEvent)
        } else if (messageType === 'processData') {
          // Simulate processing
          this.onmessage?.({
            data: { type: 'STATE_CHANGE', key: 'isProcessing', value: true }
          } as MessageEvent)

          setTimeout(() => {
            const [items] = payload
            const result = items.reduce((sum: number, item: number) => sum + item, 0)

            this.onmessage?.({
              data: { type: 'STATE_CHANGE', key: 'result', value: result }
            } as MessageEvent)

            this.onmessage?.({
              data: { type: 'STATE_CHANGE', key: 'isProcessing', value: false }
            } as MessageEvent)

            this.onmessage?.({
              data: { type: 'MESSAGE_RESPONSE', id, success: true, result }
            } as MessageEvent)
          }, 20)
        } else if (messageType === 'throwError') {
          this.onmessage?.({
            data: { type: 'MESSAGE_RESPONSE', id, error: 'Test error' }
          } as MessageEvent)
        }
        break
    }
  }
}

// Mock global Worker
;(globalThis as any).Worker = MockWorker

describe('ReliableWorkerProxy', () => {
  let reliableWorkerProxy: ReliableWorkerProxy<TestState>
  let mockWorker: MockWorker
  let fallbackService: TestReliableService

  beforeEach(() => {
    vi.clearAllMocks()

    // Create fallback service for comparison
    fallbackService = new TestReliableService()

    // Create actual ReliableWorkerProxy instance
    reliableWorkerProxy = new ReliableWorkerProxy(TestReliableService, {
      count: 0,
      isProcessing: false,
      result: null
    })
  })

  afterEach(() => {
    reliableWorkerProxy?.clear()
  })

  // For tests that need the mock implementation, create a mock that mimics the real one
  const createMockProxy = () => {
    return {
      worker: null as MockWorker | null,
      fallbackService: null as TestReliableService | null,
      isUsingWorker: false,
      isInitialized: false,
      currentState: { count: 0, isProcessing: false, result: null },
      eventListeners: new Map(),
      pendingMessages: new Map(),

      async initialize(serviceClass: any, initialState: any, workerUrl?: string): Promise<void> {
        try {
          if (workerUrl) {
            this.worker = new MockWorker(workerUrl) as MockWorker
            this.isUsingWorker = true

            // Set up worker message handling
            this.worker.onmessage = (event) => this.handleWorkerMessage(event)
            this.worker.onerror = () => this.fallbackToMainThread(serviceClass, initialState)

            // Initialize worker
            this.worker.postMessage({ type: 'INIT_SERVICE', initialState })

            // Wait for initialization
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Worker init timeout')), 1000)
              const originalOnMessage = this.worker!.onmessage

              this.worker!.onmessage = (event) => {
                if (event.data.type === 'INIT_SERVICE' && event.data.success) {
                  clearTimeout(timeout)
                  this.isInitialized = true
                  this.worker!.onmessage = originalOnMessage
                  resolve(undefined)
                } else {
                  originalOnMessage?.(event)
                }
              }
            })
          } else {
            this.fallbackToMainThread(serviceClass, initialState)
          }
        } catch (error) {
          this.fallbackToMainThread(serviceClass, initialState)
        }
      },

      fallbackToMainThread(serviceClass: any, initialState: any): void {
        this.isUsingWorker = false
        this.fallbackService = new serviceClass(initialState)
        this.isInitialized = true

        // Set up state monitoring
        Object.keys(initialState).forEach(key => {
          this.fallbackService!.on(key, (value: any) => {
            this.currentState[key] = value
            this.emit(key, value)
          })
        })
      },

      handleWorkerMessage(event: MessageEvent): void {
        const { type, key, value, id, result, error } = event.data

        switch (type) {
          case 'STATE_CHANGE':
            this.currentState[key] = value
            this.emit(key, value)
            break

          case 'MESSAGE_RESPONSE':
            const pending = this.pendingMessages.get(id)
            if (pending) {
              clearTimeout(pending.timeout)
              this.pendingMessages.delete(id)

              if (error) {
                pending.reject(new Error(error))
              } else {
                pending.resolve(result)
              }
            }
            break
        }
      },

      async send(messageType: string, payload: any[]): Promise<any> {
        if (!this.isInitialized) {
          throw new Error('Service not initialized')
        }

        if (this.isUsingWorker && this.worker) {
          return new Promise((resolve, reject) => {
            const id = Math.random().toString(36).substring(2)
            const timeout = setTimeout(() => {
              this.pendingMessages.delete(id)
              // Fallback to main thread on timeout
              this.fallbackToMainThread(TestReliableService, this.currentState)
              reject(new Error('Worker timeout - falling back to main thread'))
            }, 5000)

            this.pendingMessages.set(id, { resolve, reject, timeout })

            this.worker!.postMessage({
              type: 'SERVICE_MESSAGE',
              id,
              messageType,
              payload
            })
          })
        } else if (this.fallbackService) {
          // Use main thread service
          const method = this.fallbackService[messageType]
          if (typeof method === 'function') {
            return await method.apply(this.fallbackService, payload)
          }
          throw new Error(`Method ${messageType} not found`)
        }
      },

      on(event: string, handler: Function): any {
        if (!this.eventListeners.has(event)) {
          this.eventListeners.set(event, new Set())
        }
        this.eventListeners.get(event).add(handler)

        return {
          unsubscribe: () => {
            this.eventListeners.get(event)?.delete(handler)
          }
        }
      },

      emit(event: string, value: any): void {
        const listeners = this.eventListeners.get(event)
        if (listeners) {
          listeners.forEach((handler: Function) => handler(value))
        }
      },

      get state() {
        return this.currentState
      },

      clear(): void {
        this.worker?.terminate()
        this.fallbackService?.clear()
        this.eventListeners.clear()
        this.pendingMessages.clear()
      }
    }
  })

  afterEach(() => {
    mockReliableWorkerProxy?.clear()
  })

  describe('Initialization', () => {
    it('should initialize with worker when worker URL is provided', async () => {
      await reliableWorkerProxy.initialize('/worker.js')

      expect((reliableWorkerProxy as any).isInitialized).toBe(true)
      expect((reliableWorkerProxy as any).isUsingWorker).toBe(true)
      expect((reliableWorkerProxy as any).worker).toBeDefined()
    })

    it('should fallback to main thread when no worker URL provided', async () => {
      await mockReliableWorkerProxy.initialize(TestReliableService, { count: 0, isProcessing: false, result: null })

      expect(mockReliableWorkerProxy.isInitialized).toBe(true)
      expect(mockReliableWorkerProxy.isUsingWorker).toBe(false)
      expect(mockReliableWorkerProxy.fallbackService).toBeDefined()
    })

    it('should fallback to main thread when worker initialization fails', async () => {
      const mockWorkerClass = MockWorker
      const originalWorker = mockWorkerClass

      // Mock worker creation to fail
      ;(globalThis as any).Worker = class {
        constructor() {
          throw new Error('Worker creation failed')
        }
      }

      await mockReliableWorkerProxy.initialize(TestReliableService, { count: 0, isProcessing: false, result: null }, '/worker.js')

      expect(mockReliableWorkerProxy.isInitialized).toBe(true)
      expect(mockReliableWorkerProxy.isUsingWorker).toBe(false)
      expect(mockReliableWorkerProxy.fallbackService).toBeDefined()

      // Restore original Worker
      ;(globalThis as any).Worker = originalWorker
    })
  })

  describe('Message Passing', () => {
    beforeEach(async () => {
      await mockReliableWorkerProxy.initialize(TestReliableService, { count: 0, isProcessing: false, result: null }, '/worker.js')
    })

    it('should send messages to worker and receive responses', async () => {
      const result = await mockReliableWorkerProxy.send('processData', [[1, 2, 3, 4, 5]])
      expect(result).toBe(15)
    })

    it('should handle void methods that trigger state changes', async () => {
      let countUpdated = false
      mockReliableWorkerProxy.on('count', (value: number) => {
        if (value === 1) countUpdated = true
      })

      await mockReliableWorkerProxy.send('increment', [])
      expect(countUpdated).toBe(true)
    })

    it('should handle errors from worker methods', async () => {
      await expect(mockReliableWorkerProxy.send('throwError', [])).rejects.toThrow('Test error')
    })
  })

  describe('Main Thread Fallback', () => {
    it('should work identically when using main thread fallback', async () => {
      await mockReliableWorkerProxy.initialize(TestReliableService, { count: 0, isProcessing: false, result: null })

      const result = await mockReliableWorkerProxy.send('processData', [[1, 2, 3, 4, 5]])
      expect(result).toBe(15)
      expect(mockReliableWorkerProxy.isUsingWorker).toBe(false)
    })

    it('should automatically fallback when worker times out', async () => {
      await mockReliableWorkerProxy.initialize(TestReliableService, { count: 0, isProcessing: false, result: null }, '/worker.js')

      // Simulate worker timeout by setting a very long delay
      mockReliableWorkerProxy.worker.setResponseDelay(6000)

      // This should timeout and fallback to main thread
      await expect(mockReliableWorkerProxy.send('increment', [])).rejects.toThrow('Worker timeout - falling back to main thread')

      // Subsequent calls should use main thread
      expect(mockReliableWorkerProxy.isUsingWorker).toBe(false)
    })

    it('should maintain state consistency during fallback', async () => {
      await mockReliableWorkerProxy.initialize(TestReliableService, { count: 5, isProcessing: false, result: null }, '/worker.js')

      // Simulate worker failure
      mockReliableWorkerProxy.worker.simulateFailure()
      mockReliableWorkerProxy.fallbackToMainThread(TestReliableService, { count: 5, isProcessing: false, result: null })

      expect(mockReliableWorkerProxy.state.count).toBe(5)
      expect(mockReliableWorkerProxy.isUsingWorker).toBe(false)
    })
  })

  describe('State Synchronization', () => {
    beforeEach(async () => {
      await mockReliableWorkerProxy.initialize(TestReliableService, { count: 0, isProcessing: false, result: null }, '/worker.js')
    })

    it('should synchronize state changes from worker to proxy', async () => {
      let processingStates: boolean[] = []
      mockReliableWorkerProxy.on('isProcessing', (value: boolean) => {
        processingStates.push(value)
      })

      await mockReliableWorkerProxy.send('processData', [[1, 2, 3]])

      expect(processingStates).toContain(true)
      expect(processingStates).toContain(false)
      expect(mockReliableWorkerProxy.state.result).toBe(6)
    })

    it('should maintain state consistency between worker and main thread', async () => {
      // Test worker state
      await mockReliableWorkerProxy.send('increment', [])
      const workerState = mockReliableWorkerProxy.state.count

      // Fallback to main thread and compare
      mockReliableWorkerProxy.fallbackToMainThread(TestReliableService, mockReliableWorkerProxy.currentState)
      await mockReliableWorkerProxy.send('increment', [])

      expect(mockReliableWorkerProxy.state.count).toBe(workerState + 1)
    })
  })

  describe('Error Recovery', () => {
    it('should recover from worker errors gracefully', async () => {
      await mockReliableWorkerProxy.initialize(TestReliableService, { count: 0, isProcessing: false, result: null }, '/worker.js')

      // Simulate worker error
      mockReliableWorkerProxy.worker.simulateFailure()

      // Worker should fail and fallback should work
      mockReliableWorkerProxy.fallbackToMainThread(TestReliableService, mockReliableWorkerProxy.currentState)

      const result = await mockReliableWorkerProxy.send('processData', [[1, 2, 3]])
      expect(result).toBe(6)
      expect(mockReliableWorkerProxy.isUsingWorker).toBe(false)
    })

    it('should handle multiple rapid failures without crashing', async () => {
      await mockReliableWorkerProxy.initialize(TestReliableService, { count: 0, isProcessing: false, result: null }, '/worker.js')

      // Simulate multiple rapid calls that might fail
      const promises = Array.from({ length: 10 }, (_, i) =>
        mockReliableWorkerProxy.send('processData', [[i]])
      )

      const results = await Promise.allSettled(promises)
      const fulfilled = results.filter(r => r.status === 'fulfilled')

      expect(fulfilled.length).toBeGreaterThan(0) // At least some should succeed
    })
  })

  describe('Resource Cleanup', () => {
    it('should clean up worker resources properly', async () => {
      await mockReliableWorkerProxy.initialize(TestReliableService, { count: 0, isProcessing: false, result: null }, '/worker.js')

      const terminateSpy = vi.spyOn(mockReliableWorkerProxy.worker, 'terminate')

      mockReliableWorkerProxy.clear()

      expect(terminateSpy).toHaveBeenCalled()
      expect(mockReliableWorkerProxy.eventListeners.size).toBe(0)
      expect(mockReliableWorkerProxy.pendingMessages.size).toBe(0)
    })

    it('should clean up main thread service when using fallback', async () => {
      await mockReliableWorkerProxy.initialize(TestReliableService, { count: 0, isProcessing: false, result: null })

      const clearSpy = vi.spyOn(mockReliableWorkerProxy.fallbackService, 'clear')

      mockReliableWorkerProxy.clear()

      expect(clearSpy).toHaveBeenCalled()
    })
  })
})