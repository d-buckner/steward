import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Service } from '../src/core/Service'
import { withWorker } from '../src/core/WorkerDecorator'
import { PureMailboxWorkerRuntime } from '../src/worker/PureMailboxWorkerRuntime'

/**
 * Simplified tests for Pure Mailbox Worker Runtime
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
  constructor(initialState?: TestWorkerState) {
    super(initialState || {
      count: 0,
      data: [],
      isProcessing: false,
      result: null,
      error: null
    })
  }

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

  handleThrowError(): void {
    throw new Error('Handler error')
  }
}

describe('PureMailboxWorkerRuntime - Simplified', () => {
  let stateChanges: Array<{ key: string, value: any }> = []

  beforeEach(() => {
    vi.clearAllMocks()
    stateChanges = []

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
      PureMailboxWorkerRuntime.registerService('Service1', TestMailboxService)
      PureMailboxWorkerRuntime.registerService('Service2', TestMailboxService)

      expect((PureMailboxWorkerRuntime as any).services.size).toBe(2)
    })
  })

  describe('Service Initialization', () => {
    beforeEach(() => {
      PureMailboxWorkerRuntime.registerService('TestMailboxService', TestMailboxService)
    })

    it('should initialize registered services successfully', async () => {
      const result = await PureMailboxWorkerRuntime.initializeService('TestMailboxService', {
        count: 0,
        data: [],
        isProcessing: false,
        result: null,
        error: null
      })

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect((PureMailboxWorkerRuntime as any).currentService).toBeDefined()
      expect((PureMailboxWorkerRuntime as any).currentService).toBeInstanceOf(TestMailboxService)
    })

    it('should fail to initialize unregistered services', async () => {
      const result = await PureMailboxWorkerRuntime.initializeService('UnknownService', {})

      expect(result.success).toBe(false)
      expect(result.error).toBe('Service UnknownService not registered')
      expect((PureMailboxWorkerRuntime as any).currentService).toBeNull()
    })
  })

  describe('Pure Mailbox Message Handling', () => {
    beforeEach(async () => {
      PureMailboxWorkerRuntime.registerService('TestMailboxService', TestMailboxService)
      await PureMailboxWorkerRuntime.initializeService('TestMailboxService', {
        count: 0,
        data: [],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should handle increment messages', async () => {
      const result = await PureMailboxWorkerRuntime.handleMessage('increment', [])

      expect(result.success).toBe(true)
      expect(stateChanges).toContainEqual({ key: 'count', value: 1 })
    })

    it('should handle setData messages', async () => {
      const testData = [1, 2, 3, 4, 5]
      const result = await PureMailboxWorkerRuntime.handleMessage('setData', [testData])

      expect(result.success).toBe(true)
      expect(stateChanges).toContainEqual({ key: 'data', value: testData })
    })

    it('should handle processData messages', async () => {
      // First set some data
      await PureMailboxWorkerRuntime.handleMessage('setData', [[10, 20, 30]])

      const result = await PureMailboxWorkerRuntime.handleMessage('processData', [])

      expect(result.success).toBe(true)
      expect(stateChanges).toContainEqual({ key: 'isProcessing', value: true })
      expect(stateChanges).toContainEqual({ key: 'isProcessing', value: false })
      expect(stateChanges).toContainEqual({ key: 'result', value: 60 })
    })

    it('should handle reset messages', async () => {
      // First make some changes
      await PureMailboxWorkerRuntime.handleMessage('increment', [])
      await PureMailboxWorkerRuntime.handleMessage('setData', [[1, 2, 3]])

      stateChanges.length = 0 // Clear previous state changes

      const result = await PureMailboxWorkerRuntime.handleMessage('reset', [])

      expect(result.success).toBe(true)
      expect(stateChanges).toContainEqual({ key: 'count', value: 0 })
      expect(stateChanges).toContainEqual({ key: 'data', value: [] })
    })

    it('should handle error messages', async () => {
      const result = await PureMailboxWorkerRuntime.handleMessage('error', [])

      expect(result.success).toBe(true)
      expect(stateChanges).toContainEqual({ key: 'error', value: 'Intentional test error' })
    })
  })

  describe('Message Handler Discovery', () => {
    beforeEach(async () => {
      PureMailboxWorkerRuntime.registerService('TestMailboxService', TestMailboxService)
      await PureMailboxWorkerRuntime.initializeService('TestMailboxService', {
        count: 0,
        data: [],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should map message types to handler methods correctly', async () => {
      const testCases = [
        { messageType: 'increment', expected: true },
        { messageType: 'setData', expected: true },
        { messageType: 'processData', expected: true },
        { messageType: 'reset', expected: true }
      ]

      for (const { messageType, expected } of testCases) {
        const result = await PureMailboxWorkerRuntime.handleMessage(messageType, [])
        expect(result.success).toBe(expected)
      }
    })

    it('should fail for unknown message types', async () => {
      const result = await PureMailboxWorkerRuntime.handleMessage('unknownMessage', [])

      expect(result.success).toBe(false)
      expect(result.error).toBe('No handler for message type: unknownMessage')
    })

    it('should handle messages with no service initialized', async () => {
      PureMailboxWorkerRuntime.clear()

      const result = await PureMailboxWorkerRuntime.handleMessage('increment', [])

      expect(result.success).toBe(false)
      expect(result.error).toBe('No service initialized')
    })
  })

  describe('State Change Events', () => {
    beforeEach(async () => {
      PureMailboxWorkerRuntime.registerService('TestMailboxService', TestMailboxService)
      await PureMailboxWorkerRuntime.initializeService('TestMailboxService', {
        count: 0,
        data: [],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should emit state changes for single setState calls', async () => {
      await PureMailboxWorkerRuntime.handleMessage('increment', [])

      expect(stateChanges).toHaveLength(1)
      expect(stateChanges[0]).toEqual({ key: 'count', value: 1 })
    })

    it('should emit multiple state changes for setStates calls', async () => {
      await PureMailboxWorkerRuntime.handleMessage('reset', [])

      expect(stateChanges.length).toBeGreaterThan(1)
      expect(stateChanges).toContainEqual({ key: 'count', value: 0 })
      expect(stateChanges).toContainEqual({ key: 'data', value: [] })
    })

    it('should handle state change listener errors gracefully', async () => {
      // Add a listener that throws
      PureMailboxWorkerRuntime.onStateChange(() => {
        throw new Error('Listener error')
      })

      // Should not crash when state changes
      await expect(PureMailboxWorkerRuntime.handleMessage('increment', [])).resolves.toEqual({
        success: true,
        result: undefined
      })
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      PureMailboxWorkerRuntime.registerService('TestMailboxService', TestMailboxService)
      await PureMailboxWorkerRuntime.initializeService('TestMailboxService', {
        count: 0,
        data: [],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should handle handler method errors', async () => {
      const result = await PureMailboxWorkerRuntime.handleMessage('throwError', [])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Handler error')
    })

    it('should continue working after errors', async () => {
      // Cause an error
      await PureMailboxWorkerRuntime.handleMessage('unknownMessage', [])

      // Should still be able to process valid messages
      const result = await PureMailboxWorkerRuntime.handleMessage('increment', [])
      expect(result.success).toBe(true)
    })
  })

  describe('Resource Cleanup', () => {
    beforeEach(async () => {
      PureMailboxWorkerRuntime.registerService('TestMailboxService', TestMailboxService)
      await PureMailboxWorkerRuntime.initializeService('TestMailboxService', {
        count: 0,
        data: [],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should clear all resources', () => {
      expect((PureMailboxWorkerRuntime as any).services.size).toBeGreaterThan(0)
      expect((PureMailboxWorkerRuntime as any).currentService).not.toBeNull()
      expect((PureMailboxWorkerRuntime as any).stateChangeListeners.length).toBeGreaterThan(0)

      PureMailboxWorkerRuntime.clear()

      expect((PureMailboxWorkerRuntime as any).services.size).toBe(0)
      expect((PureMailboxWorkerRuntime as any).currentService).toBeNull()
      expect((PureMailboxWorkerRuntime as any).stateChangeListeners.length).toBe(0)
    })
  })

  describe('Service State Access', () => {
    beforeEach(async () => {
      PureMailboxWorkerRuntime.registerService('TestMailboxService', TestMailboxService)
      await PureMailboxWorkerRuntime.initializeService('TestMailboxService', {
        count: 5,
        data: [1, 2, 3],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should provide access to service state', () => {
      const state = PureMailboxWorkerRuntime.getServiceState()

      expect(state).toEqual({
        count: 5,
        data: [1, 2, 3],
        isProcessing: false,
        result: null,
        error: null
      })
    })

    it('should return empty state when no service is initialized', () => {
      PureMailboxWorkerRuntime.clear()

      const state = PureMailboxWorkerRuntime.getServiceState()
      expect(state).toEqual({})
    })
  })
})