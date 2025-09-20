import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Service } from '../src/core/Service'
import { withWorker } from '../src/core/WorkerDecorator'
import { ReliableWorkerProxy } from '../src/core/ReliableWorkerProxy'

/**
 * Simplified tests for ReliableWorkerProxy to validate core functionality
 */

interface TestState {
  count: number
  isProcessing: boolean
  result: number | null
}

@withWorker('TestReliableService')
class TestReliableService extends Service<TestState> {
  constructor(initialState?: TestState) {
    super(initialState || {
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

  constructor(public url: string) {
    super()
  }

  postMessage(data: any): void {
    setTimeout(() => {
      if (data.type === 'INIT_SERVICE') {
        this.onmessage?.({
          data: { type: 'INIT_SERVICE', success: true }
        } as MessageEvent)
      }
    }, 10)
  }

  terminate(): void {
    // Mock termination
  }
}

// Mock global Worker
;(globalThis as any).Worker = MockWorker

describe('ReliableWorkerProxy - Simplified', () => {
  let proxy: ReliableWorkerProxy<TestState>

  beforeEach(() => {
    vi.clearAllMocks()
    proxy = new ReliableWorkerProxy(TestReliableService, {
      count: 0,
      isProcessing: false,
      result: null
    })
  })

  afterEach(() => {
    proxy?.clear()
  })

  describe('Main Thread Fallback', () => {
    it('should initialize without worker URL (main thread only)', async () => {
      await proxy.initialize()

      expect((proxy as any).isInitialized).toBe(true)
      expect((proxy as any).isUsingWorker).toBe(false)
      expect((proxy as any).fallbackService).toBeDefined()
    })

    it('should work with main thread service', async () => {
      await proxy.initialize() // No worker URL = main thread

      const result = await proxy.send('processData', [[1, 2, 3, 4, 5]])
      expect(result).toBe(15)
    })

    it('should handle state changes in main thread mode', async () => {
      await proxy.initialize()

      let countUpdated = false
      proxy.on('count', (value: number) => {
        if (value === 1) countUpdated = true
      })

      await proxy.send('increment', [])
      expect(countUpdated).toBe(true)
      expect(proxy.state.count).toBe(1)
    })

    it('should handle errors in main thread mode', async () => {
      await proxy.initialize()

      await expect(proxy.send('throwError', [])).rejects.toThrow('Test error')
    })
  })

  describe('Worker Mode', () => {
    it('should attempt worker initialization with URL', async () => {
      await proxy.initialize('/worker.js')

      expect((proxy as any).isInitialized).toBe(true)
    })

    it('should maintain state proxy interface', () => {
      expect(proxy.state).toBeDefined()
      expect(proxy.state.count).toBe(0)
      expect(proxy.state.isProcessing).toBe(false)
      expect(proxy.state.result).toBeNull()
    })

    it('should prevent direct state modification', () => {
      expect(() => {
        ;(proxy.state as any).count = 5
      }).toThrow('Cannot directly modify service state')
    })
  })

  describe('Event System', () => {
    beforeEach(async () => {
      await proxy.initialize() // Use main thread for reliable testing
    })

    it('should support event listeners', () => {
      let callCount = 0
      const subscription = proxy.on('count', () => callCount++)

      expect(proxy.hasListeners('count')).toBe(true)
      expect(proxy.getListenerCount('count')).toBe(1)

      subscription.unsubscribe()
      expect(proxy.hasListeners('count')).toBe(false)
    })

    it('should support once listeners', async () => {
      let callCount = 0
      proxy.once('count', () => callCount++)

      await proxy.send('increment', [])
      await proxy.send('increment', [])

      expect(callCount).toBe(1) // Should only be called once
    })

    it('should clean up listeners', () => {
      proxy.on('count', () => {})
      proxy.on('result', () => {})

      expect(proxy.hasListeners('count')).toBe(true)
      expect(proxy.hasListeners('result')).toBe(true)

      proxy.removeAllListeners()

      expect(proxy.hasListeners('count')).toBe(false)
      expect(proxy.hasListeners('result')).toBe(false)
    })
  })

  describe('Resource Management', () => {
    it('should clean up properly', async () => {
      await proxy.initialize()

      proxy.on('count', () => {})
      expect(proxy.hasListeners('count')).toBe(true)

      proxy.clear()

      expect(proxy.hasListeners('count')).toBe(false)
      expect((proxy as any).isInitialized).toBe(false)
    })

    it('should provide current state', async () => {
      await proxy.initialize()

      const state = proxy.getState()
      expect(state).toEqual({
        count: 0,
        isProcessing: false,
        result: null
      })

      // Should be a copy, not reference
      state.count = 999
      expect(proxy.state.count).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle initialization without throwing', async () => {
      await expect(proxy.initialize()).resolves.not.toThrow()
    })

    it('should handle send before initialization', async () => {
      await expect(proxy.send('increment', [])).rejects.toThrow('Service not initialized')
    })

    it('should handle unknown methods', async () => {
      await proxy.initialize()
      await expect(proxy.send('unknownMethod' as any, [])).rejects.toThrow()
    })
  })
})