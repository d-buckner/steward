import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Service } from '../src/core/Service'
import { withWorker } from '../src/core/WorkerDecorator'
import { PureMailboxWorkerRuntime } from '../src/worker/PureMailboxWorkerRuntime'

/**
 * Tests for Pure Mailbox Worker Runtime
 *
 * This tests a simplified worker runtime that:
 * - Uses pure message passing (no method dispatch)
 * - Has event-sourced state synchronization
 * - Eliminates complex service discovery
 * - Follows true mailbox architecture principles
 * - Has predictable error handling
 */

interface TestWorkerState {
  count: number
  data: number[]
  isProcessing: boolean
  result: number | null
  error: string | null
}

@withWorker('TestMailboxService')
class TestMailboxService extends Service<TestWorkerState> {
  constructor() {
    super({
      count: 0,
      data: [],
      isProcessing: false,
      result: null,
      error: null
    })
  }

  // Pure mailbox methods - they only handle messages and emit state changes
  handleIncrement(): void {
    this.setState('count', this.state.count + 1)
  }

  handleSetData(data: number[]): void {
    this.setState('data', data)
  }

  async handleProcessData(): Promise<void> {
    this.setState('isProcessing', true)
    this.setState('error', null)

    try {
      // Simulate async processing
      await new Promise(resolve => setTimeout(resolve, 10))

      const result = this.state.data.reduce((sum, item) => sum + item, 0)
      this.setState('result', result)
    } catch (error) {
      this.setState('error', (error as Error).message)
    } finally {
      this.setState('isProcessing', false)
    }
  }

  handleReset(): void {
    this.setStates({
      count: 0,
      data: [],
      isProcessing: false,
      result: null,
      error: null
    })
  }

  handleError(): void {
    this.setState('error', 'Intentional test error')
  }
}

// Mock worker context
const createMockWorkerContext = () => {
  const context = {
    services: new Map(),
    currentService: null as any,
    messageHandlers: new Map(),
    stateChangeListeners: [] as Array<(key: string, value: any) => void>,

    // Message types that the runtime should handle
    MESSAGE_TYPES: {
      REGISTER_SERVICE: 'REGISTER_SERVICE',
      INIT_SERVICE: 'INIT_SERVICE',
      MESSAGE: 'MESSAGE',
      STATE_CHANGE: 'STATE_CHANGE',
      ERROR: 'ERROR'
    },

    // Register a service class in the worker
    registerService(name: string, serviceClass: any): void {
      this.services.set(name, serviceClass)
    },

    // Initialize a service instance
    async initializeService(serviceName: string, initialState: any): Promise<{ success: boolean, error?: string }> {
      try {
        const ServiceClass = this.services.get(serviceName)
        if (!ServiceClass) {
          return { success: false, error: `Service ${serviceName} not registered` }
        }

        this.currentService = new ServiceClass()

        // Override service's setState to emit state changes
        const originalSetState = this.currentService.setState.bind(this.currentService)
        this.currentService.setState = (key: string, value: any) => {
          originalSetState(key, value)
          this.emitStateChange(key, value)
        }

        // Override service's setStates to emit multiple state changes
        const originalSetStates = this.currentService.setStates.bind(this.currentService)
        this.currentService.setStates = (updates: Record<string, any>) => {
          originalSetStates(updates)
          Object.entries(updates).forEach(([key, value]) => {
            this.emitStateChange(key, value)
          })
        }

        return { success: true }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    },

    // Handle incoming messages using pure mailbox pattern
    async handleMessage(messageType: string, payload: any): Promise<{ success: boolean, result?: any, error?: string }> {
      try {
        if (!this.currentService) {
          return { success: false, error: 'No service initialized' }
        }

        // Pure mailbox routing - map message types to handler methods
        const handlerName = `handle${messageType.charAt(0).toUpperCase() + messageType.slice(1)}`
        const handler = this.currentService[handlerName]

        if (typeof handler !== 'function') {
          return { success: false, error: `No handler for message type: ${messageType}` }
        }

        // Call handler with payload
        const result = Array.isArray(payload)
          ? await handler.apply(this.currentService, payload)
          : await handler.call(this.currentService, payload)

        return { success: true, result }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    },

    // Emit state changes to listeners
    emitStateChange(key: string, value: any): void {
      this.stateChangeListeners.forEach(listener => {
        try {
          listener(key, value)
        } catch (error) {
          console.error('State change listener error:', error)
        }
      })
    },

    // Add state change listener
    onStateChange(listener: (key: string, value: any) => void): void {
      this.stateChangeListeners.push(listener)
    },

    // Get current service state
    getServiceState(): any {
      return this.currentService?.getState() || {}
    },

    // Clear everything for cleanup
    clear(): void {
      this.currentService?.clear()
      this.services.clear()
      this.messageHandlers.clear()
      this.stateChangeListeners.length = 0
      this.currentService = null
    }
  }

  return context
}

describe('PureMailboxWorkerRuntime', () => {
  let stateChanges: Array<{ key: string, value: any }> = []

  beforeEach(() => {
    vi.clearAllMocks()
    stateChanges = []

    // Clear any existing registrations
    PureMailboxWorkerRuntime.clear()

    // Listen for state changes
    PureMailboxWorkerRuntime.onStateChange((key, value) => {
      stateChanges.push({ key, value })
    })
  })

  afterEach(() => {
    PureMailboxWorkerRuntime.clear()
  })

  describe('Service Registration', () => {
    it('should register services by name', () => {
      PureMailboxWorkerRuntime.registerService('TestMailboxService', TestMailboxService)

      expect((PureMailboxWorkerRuntime as any).services.has('TestMailboxService')).toBe(true)
      expect((PureMailboxWorkerRuntime as any).services.get('TestMailboxService')).toBe(TestMailboxService)
    })

    it('should handle multiple service registrations', () => {
      mockWorkerContext.registerService('Service1', TestMailboxService)
      mockWorkerContext.registerService('Service2', TestMailboxService)

      expect(mockWorkerContext.services.size).toBe(2)
      expect(mockWorkerContext.services.has('Service1')).toBe(true)
      expect(mockWorkerContext.services.has('Service2')).toBe(true)
    })
  })

  describe('Service Initialization', () => {
    beforeEach(() => {
      mockWorkerContext.registerService('TestMailboxService', TestMailboxService)
    })

    it('should initialize registered services successfully', async () => {
      const result = await mockWorkerContext.initializeService('TestMailboxService', {
        count: 0,
        data: [],
        isProcessing: false,
        result: null,
        error: null
      })

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mockWorkerContext.currentService).toBeDefined()
      expect(mockWorkerContext.currentService).toBeInstanceOf(TestMailboxService)
    })

    it('should fail to initialize unregistered services', async () => {
      const result = await mockWorkerContext.initializeService('UnknownService', {})

      expect(result.success).toBe(false)
      expect(result.error).toBe('Service UnknownService not registered')
      expect(mockWorkerContext.currentService).toBeNull()
    })

    it('should handle service initialization errors', async () => {
      // Register a service class that throws in constructor
      class FailingService {
        constructor() {
          throw new Error('Constructor failed')
        }
      }

      mockWorkerContext.registerService('FailingService', FailingService)

      const result = await mockWorkerContext.initializeService('FailingService', {})

      expect(result.success).toBe(false)
      expect(result.error).toBe('Constructor failed')
    })
  })

  describe('Pure Mailbox Message Handling', () => {
    beforeEach(async () => {
      mockWorkerContext.registerService('TestMailboxService', TestMailboxService)
      await mockWorkerContext.initializeService('TestMailboxService', {
        count: 0,
        data: [],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should handle increment messages', async () => {
      const result = await mockWorkerContext.handleMessage('increment', [])

      expect(result.success).toBe(true)
      expect(stateChanges).toContainEqual({ key: 'count', value: 1 })
    })

    it('should handle setData messages', async () => {
      const testData = [1, 2, 3, 4, 5]
      const result = await mockWorkerContext.handleMessage('setData', [testData])

      expect(result.success).toBe(true)
      expect(stateChanges).toContainEqual({ key: 'data', value: testData })
      expect(mockWorkerContext.getServiceState().data).toEqual(testData)
    })

    it('should handle processData messages', async () => {
      // First set some data
      await mockWorkerContext.handleMessage('setData', [[10, 20, 30]])

      const result = await mockWorkerContext.handleMessage('processData', [])

      expect(result.success).toBe(true)

      // Should have emitted processing states
      expect(stateChanges).toContainEqual({ key: 'isProcessing', value: true })
      expect(stateChanges).toContainEqual({ key: 'isProcessing', value: false })
      expect(stateChanges).toContainEqual({ key: 'result', value: 60 })
    })

    it('should handle reset messages', async () => {
      // First make some changes
      await mockWorkerContext.handleMessage('increment', [])
      await mockWorkerContext.handleMessage('setData', [[1, 2, 3]])

      stateChanges.length = 0 // Clear previous state changes

      const result = await mockWorkerContext.handleMessage('reset', [])

      expect(result.success).toBe(true)
      expect(stateChanges).toContainEqual({ key: 'count', value: 0 })
      expect(stateChanges).toContainEqual({ key: 'data', value: [] })
      expect(stateChanges).toContainEqual({ key: 'isProcessing', value: false })
      expect(stateChanges).toContainEqual({ key: 'result', value: null })
      expect(stateChanges).toContainEqual({ key: 'error', value: null })
    })

    it('should handle error messages', async () => {
      const result = await mockWorkerContext.handleMessage('error', [])

      expect(result.success).toBe(true)
      expect(stateChanges).toContainEqual({ key: 'error', value: 'Intentional test error' })
    })
  })

  describe('Message Handler Discovery', () => {
    beforeEach(async () => {
      mockWorkerContext.registerService('TestMailboxService', TestMailboxService)
      await mockWorkerContext.initializeService('TestMailboxService', {
        count: 0,
        data: [],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should map message types to handler methods correctly', async () => {
      // Test camelCase conversion
      const testCases = [
        { messageType: 'increment', handlerName: 'handleIncrement' },
        { messageType: 'setData', handlerName: 'handleSetData' },
        { messageType: 'processData', handlerName: 'handleProcessData' },
        { messageType: 'reset', handlerName: 'handleReset' }
      ]

      for (const { messageType, handlerName } of testCases) {
        const handler = mockWorkerContext.currentService[handlerName]
        expect(typeof handler).toBe('function')

        const result = await mockWorkerContext.handleMessage(messageType, [])
        expect(result.success).toBe(true)
      }
    })

    it('should fail for unknown message types', async () => {
      const result = await mockWorkerContext.handleMessage('unknownMessage', [])

      expect(result.success).toBe(false)
      expect(result.error).toBe('No handler for message type: unknownMessage')
    })

    it('should handle messages with no service initialized', async () => {
      mockWorkerContext.currentService = null

      const result = await mockWorkerContext.handleMessage('increment', [])

      expect(result.success).toBe(false)
      expect(result.error).toBe('No service initialized')
    })
  })

  describe('State Change Events', () => {
    beforeEach(async () => {
      mockWorkerContext.registerService('TestMailboxService', TestMailboxService)
      await mockWorkerContext.initializeService('TestMailboxService', {
        count: 0,
        data: [],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should emit state changes for single setState calls', async () => {
      await mockWorkerContext.handleMessage('increment', [])

      expect(stateChanges).toHaveLength(1)
      expect(stateChanges[0]).toEqual({ key: 'count', value: 1 })
    })

    it('should emit multiple state changes for setStates calls', async () => {
      await mockWorkerContext.handleMessage('reset', [])

      // Reset calls setStates with multiple properties
      expect(stateChanges.length).toBeGreaterThan(1)
      expect(stateChanges).toContainEqual({ key: 'count', value: 0 })
      expect(stateChanges).toContainEqual({ key: 'data', value: [] })
    })

    it('should handle state change listener errors gracefully', async () => {
      // Add a listener that throws
      mockWorkerContext.onStateChange(() => {
        throw new Error('Listener error')
      })

      // Should not crash when state changes
      await expect(mockWorkerContext.handleMessage('increment', [])).resolves.toEqual({
        success: true,
        result: undefined
      })
    })
  })

  describe('Async Message Handling', () => {
    beforeEach(async () => {
      mockWorkerContext.registerService('TestMailboxService', TestMailboxService)
      await mockWorkerContext.initializeService('TestMailboxService', {
        count: 0,
        data: [10, 20, 30],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should handle async messages correctly', async () => {
      const result = await mockWorkerContext.handleMessage('processData', [])

      expect(result.success).toBe(true)

      // Should have correct final state
      const finalState = mockWorkerContext.getServiceState()
      expect(finalState.isProcessing).toBe(false)
      expect(finalState.result).toBe(60)
    })

    it('should emit state changes in correct order for async operations', async () => {
      await mockWorkerContext.handleMessage('processData', [])

      const processingStates = stateChanges
        .filter(change => change.key === 'isProcessing')
        .map(change => change.value)

      expect(processingStates).toEqual([true, false])
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      mockWorkerContext.registerService('TestMailboxService', TestMailboxService)
      await mockWorkerContext.initializeService('TestMailboxService', {
        count: 0,
        data: [],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should handle handler method errors', async () => {
      // Create a service with a handler that throws
      class ErrorService extends Service<{ error: string | null }> {
        constructor() {
          super({ error: null })
        }

        handleThrowError(): void {
          throw new Error('Handler error')
        }
      }

      mockWorkerContext.registerService('ErrorService', ErrorService)
      await mockWorkerContext.initializeService('ErrorService', { error: null })

      const result = await mockWorkerContext.handleMessage('throwError', [])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Handler error')
    })

    it('should continue working after errors', async () => {
      // Cause an error
      await mockWorkerContext.handleMessage('unknownMessage', [])

      // Should still be able to process valid messages
      const result = await mockWorkerContext.handleMessage('increment', [])
      expect(result.success).toBe(true)
    })
  })

  describe('Resource Cleanup', () => {
    beforeEach(async () => {
      mockWorkerContext.registerService('TestMailboxService', TestMailboxService)
      await mockWorkerContext.initializeService('TestMailboxService', {
        count: 0,
        data: [],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should clear all resources', () => {
      expect(mockWorkerContext.services.size).toBeGreaterThan(0)
      expect(mockWorkerContext.currentService).not.toBeNull()
      expect(mockWorkerContext.stateChangeListeners.length).toBeGreaterThan(0)

      mockWorkerContext.clear()

      expect(mockWorkerContext.services.size).toBe(0)
      expect(mockWorkerContext.currentService).toBeNull()
      expect(mockWorkerContext.stateChangeListeners.length).toBe(0)
    })

    it('should call service clear method on cleanup', () => {
      const clearSpy = vi.spyOn(mockWorkerContext.currentService, 'clear')

      mockWorkerContext.clear()

      expect(clearSpy).toHaveBeenCalled()
    })
  })
})