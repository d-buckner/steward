import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Service } from '../src/core/Service'
import { withWorker } from '../src/core/WorkerDecorator'
import { createServiceToken } from '../src/core/ServiceTokens'
import { ReliableServiceContainer } from '../src/core/ReliableServiceContainer'
import { ReliableWorkerRegistry } from '../src/core/ReliableWorkerRegistry'

/**
 * Integration tests for ReliableServiceContainer
 * Tests the full flow of service registration, resolution, and execution
 */

interface TestState {
  count: number
  isProcessing: boolean
  result: number | null
}

// Worker service for testing
@withWorker('TestWorkerService')
class TestWorkerService extends Service<TestState> {
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
    const result = items.reduce((sum, item) => sum + item, 0)
    this.setState('result', result)
    this.setState('isProcessing', false)
    return result
  }
}

// Regular main thread service for testing
class TestMainService extends Service<TestState> {
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
    const result = items.reduce((sum, item) => sum + item, 0)
    this.setState('result', result)
    this.setState('isProcessing', false)
    return result
  }
}

// Service tokens
const TestWorkerToken = createServiceToken<TestWorkerService>('testWorker')
const TestMainToken = createServiceToken<TestMainService>('testMain')

// Mock Worker
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

;(globalThis as any).Worker = MockWorker

describe('ReliableServiceContainer Integration', () => {
  let container: ReliableServiceContainer

  beforeEach(() => {
    vi.clearAllMocks()

    // Clear registry
    ReliableWorkerRegistry.clear()

    // Create new container
    container = new ReliableServiceContainer()
  })

  afterEach(() => {
    container?.dispose()
    ReliableWorkerRegistry.clear()
  })

  describe('Service Registration', () => {
    it('should register worker services with bundles', () => {
      container.register(TestWorkerToken, TestWorkerService, '/worker.js')

      expect(container.hasService(TestWorkerToken)).toBe(true)

      const info = container.getServiceInfo(TestWorkerToken)
      expect(info.isRegistered).toBe(true)
      expect(info.isWorkerService).toBe(true)
      expect(info.hasWorkerBundle).toBe(true)
      expect(info.workerBundle).toBe('/worker.js')
    })

    it('should register main thread services without bundles', () => {
      container.register(TestMainToken, TestMainService)

      expect(container.hasService(TestMainToken)).toBe(true)

      const info = container.getServiceInfo(TestMainToken)
      expect(info.isRegistered).toBe(true)
      expect(info.isWorkerService).toBe(false)
      expect(info.hasWorkerBundle).toBe(false)
    })

    it('should register multiple services at once', () => {
      container.registerServices([
        { token: TestWorkerToken, serviceConstructor: TestWorkerService, workerBundle: '/worker.js' },
        { token: TestMainToken, serviceConstructor: TestMainService }
      ])

      expect(container.hasService(TestWorkerToken)).toBe(true)
      expect(container.hasService(TestMainToken)).toBe(true)

      const stats = container.getStats()
      expect(stats.totalServices).toBe(2)
      expect(stats.workerServices).toBe(1)
      expect(stats.mainThreadServices).toBe(1)
    })
  })

  describe('Service Resolution', () => {
    beforeEach(() => {
      container.register(TestWorkerToken, TestWorkerService, '/worker.js')
      container.register(TestMainToken, TestMainService)
    })

    it('should resolve worker services as ReliableWorkerProxy', () => {
      const service = container.resolve(TestWorkerToken)

      expect(service).toBeDefined()
      expect(service.constructor.name).toBe('ReliableWorkerProxy')
      expect(service.state).toBeDefined()
      expect(typeof service.send).toBe('function')
    })

    it('should resolve main thread services directly', () => {
      const service = container.resolve(TestMainToken)

      expect(service).toBeDefined()
      expect(service.constructor.name).toBe('TestMainService')
      expect(service.state).toBeDefined()
      expect(typeof service.increment).toBe('function')
    })

    it('should return same instance on multiple resolve calls', () => {
      const service1 = container.resolve(TestMainToken)
      const service2 = container.resolve(TestMainToken)

      expect(service1).toBe(service2)
    })

    it('should fail to resolve unregistered services', () => {
      const UnregisteredToken = createServiceToken<TestMainService>('unregistered')

      expect(() => container.resolve(UnregisteredToken)).toThrow(
        'Service not registered for token: unregistered'
      )
    })
  })

  describe('Service Constructor Access', () => {
    beforeEach(() => {
      container.register(TestWorkerToken, TestWorkerService, '/worker.js')
      container.register(TestMainToken, TestMainService)
    })

    it('should provide access to original service constructors', () => {
      const workerConstructor = container.getServiceConstructor(TestWorkerToken)
      const mainConstructor = container.getServiceConstructor(TestMainToken)

      expect(workerConstructor).toBe(TestWorkerService)
      expect(mainConstructor).toBe(TestMainService)
    })

    it('should return undefined for unregistered services', () => {
      const UnregisteredToken = createServiceToken<TestMainService>('unregistered')
      const constructor = container.getServiceConstructor(UnregisteredToken)

      expect(constructor).toBeUndefined()
    })
  })

  describe('Service Execution', () => {
    beforeEach(async () => {
      container.register(TestMainToken, TestMainService)
    })

    it('should execute main thread service methods directly', async () => {
      const service = container.resolve(TestMainToken) as TestMainService

      // Test synchronous method
      service.increment()
      expect(service.state.count).toBe(1)

      // Test asynchronous method
      const result = await service.processData([1, 2, 3, 4, 5])
      expect(result).toBe(15)
      expect(service.state.result).toBe(15)
    })

    it('should handle state changes and events', async () => {
      const service = container.resolve(TestMainToken) as TestMainService

      let stateChanges: any[] = []
      service.on('count', (value) => stateChanges.push({ key: 'count', value }))
      service.on('isProcessing', (value) => stateChanges.push({ key: 'isProcessing', value }))
      service.on('result', (value) => stateChanges.push({ key: 'result', value }))

      await service.processData([10, 20])

      expect(stateChanges).toContainEqual({ key: 'isProcessing', value: true })
      expect(stateChanges).toContainEqual({ key: 'result', value: 30 })
      expect(stateChanges).toContainEqual({ key: 'isProcessing', value: false })
    })
  })

  describe('Worker Service Execution', () => {
    beforeEach(() => {
      container.register(TestWorkerToken, TestWorkerService, '/worker.js')
    })

    it('should create worker proxy for worker services', async () => {
      const service = container.resolve(TestWorkerToken)

      expect(service.constructor.name).toBe('ReliableWorkerProxy')
      expect(typeof service.send).toBe('function')
      expect(service.state).toBeDefined()
    })

    it('should provide reactive state interface', () => {
      const service = container.resolve(TestWorkerToken)

      expect(service.state.count).toBe(0)
      expect(service.state.isProcessing).toBe(false)
      expect(service.state.result).toBeNull()

      // State should not be directly modifiable
      expect(() => {
        ;(service.state as any).count = 5
      }).toThrow('Cannot directly modify service state')
    })
  })

  describe('Preloading', () => {
    beforeEach(() => {
      container.register(TestWorkerToken, TestWorkerService, '/worker.js')
      container.register(TestMainToken, TestMainService)
    })

    it('should preload individual services', async () => {
      await expect(container.preload(TestMainToken)).resolves.not.toThrow()
      expect(container.resolve(TestMainToken)).toBeDefined()
    })

    it('should preload multiple services concurrently', async () => {
      const startTime = Date.now()
      await container.preloadServices([TestWorkerToken, TestMainToken])
      const duration = Date.now() - startTime

      // Should complete relatively quickly (not timeout)
      expect(duration).toBeLessThan(1000)

      // Services should be available
      expect(container.resolve(TestWorkerToken)).toBeDefined()
      expect(container.resolve(TestMainToken)).toBeDefined()
    })
  })

  describe('Resource Management', () => {
    beforeEach(() => {
      container.register(TestWorkerToken, TestWorkerService, '/worker.js')
      container.register(TestMainToken, TestMainService)
    })

    it('should clean up all services on dispose', () => {
      const workerService = container.resolve(TestWorkerToken)
      const mainService = container.resolve(TestMainToken)

      const workerClearSpy = vi.spyOn(workerService, 'clear')
      const mainClearSpy = vi.spyOn(mainService, 'clear')

      container.dispose()

      expect(workerClearSpy).toHaveBeenCalled()
      expect(mainClearSpy).toHaveBeenCalled()
    })

    it('should provide registry statistics', () => {
      const stats = container.getStats()

      expect(stats).toHaveProperty('totalServices')
      expect(stats).toHaveProperty('workerServices')
      expect(stats).toHaveProperty('mainThreadServices')
      expect(stats).toHaveProperty('servicesWithBundles')

      expect(stats.totalServices).toBe(2)
      expect(stats.workerServices).toBe(1)
      expect(stats.mainThreadServices).toBe(1)
      expect(stats.servicesWithBundles).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle registration of services without tokens gracefully', () => {
      // This should not throw during registration
      expect(() => {
        container.register(TestMainToken, TestMainService)
      }).not.toThrow()
    })

    it('should handle resolution errors gracefully', () => {
      const UnknownToken = createServiceToken<TestMainService>('unknown')

      expect(() => container.resolve(UnknownToken)).toThrow(
        'Service not registered for token: unknown'
      )
    })

    it('should handle service info for unregistered services', () => {
      const UnknownToken = createServiceToken<TestMainService>('unknown')
      const info = container.getServiceInfo(UnknownToken)

      expect(info.isRegistered).toBe(false)
      expect(info.isWorkerService).toBe(false)
      expect(info.hasWorkerBundle).toBe(false)
    })
  })
})