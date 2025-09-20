import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Service } from '../src/core/Service'
import { withWorker } from '../src/core/WorkerDecorator'

/**
 * Tests for the Reliable Worker Registry
 *
 * This tests a simplified approach that eliminates:
 * - Dynamic imports with multiple fallback paths
 * - Runtime service discovery
 * - Complex registry lookup logic
 *
 * Instead, it uses build-time service registration with predictable behavior.
 */

interface TestState {
  count: number
  isProcessing: boolean
}

// Test service that should work in workers
@withWorker('TestWorkerService')
class TestWorkerService extends Service<TestState> {
  constructor() {
    super({
      count: 0,
      isProcessing: false
    })
  }

  increment(): void {
    this.setState('count', this.state.count + 1)
  }

  async processData(items: number[]): Promise<number> {
    this.setState('isProcessing', true)
    const result = items.reduce((sum, item) => sum + item, 0)
    this.setState('isProcessing', false)
    return result
  }
}

// Regular service for comparison
class TestMainThreadService extends Service<TestState> {
  constructor() {
    super({
      count: 0,
      isProcessing: false
    })
  }

  increment(): void {
    this.setState('count', this.state.count + 1)
  }

  async processData(items: number[]): Promise<number> {
    this.setState('isProcessing', true)
    const result = items.reduce((sum, item) => sum + item, 0)
    this.setState('isProcessing', false)
    return result
  }
}

describe('ReliableWorkerRegistry', () => {
  let mockReliableWorkerRegistry: any

  beforeEach(() => {
    // Reset any global state
    vi.clearAllMocks()

    // Mock the ReliableWorkerRegistry that we'll implement
    mockReliableWorkerRegistry = {
      services: new Map(),
      workerBundles: new Map(),

      // Build-time registration (no dynamic discovery)
      registerService(name: string, serviceClass: any, workerBundle?: string) {
        this.services.set(name, serviceClass)
        if (workerBundle) {
          this.workerBundles.set(name, workerBundle)
        }
      },

      hasService(name: string): boolean {
        return this.services.has(name)
      },

      getServiceClass(name: string) {
        return this.services.get(name)
      },

      getWorkerBundle(name: string): string | undefined {
        return this.workerBundles.get(name)
      },

      isWorkerService(name: string): boolean {
        const serviceClass = this.services.get(name)
        return serviceClass?.__isWorkerService === true
      },

      clear() {
        this.services.clear()
        this.workerBundles.clear()
      }
    }
  })

  describe('Service Registration', () => {
    it('should register worker services at build time', () => {
      mockReliableWorkerRegistry.registerService('TestWorkerService', TestWorkerService, '/workers/test.js')

      expect(mockReliableWorkerRegistry.hasService('TestWorkerService')).toBe(true)
      expect(mockReliableWorkerRegistry.getServiceClass('TestWorkerService')).toBe(TestWorkerService)
      expect(mockReliableWorkerRegistry.getWorkerBundle('TestWorkerService')).toBe('/workers/test.js')
    })

    it('should register main thread services without worker bundles', () => {
      mockReliableWorkerRegistry.registerService('TestMainThreadService', TestMainThreadService)

      expect(mockReliableWorkerRegistry.hasService('TestMainThreadService')).toBe(true)
      expect(mockReliableWorkerRegistry.getServiceClass('TestMainThreadService')).toBe(TestMainThreadService)
      expect(mockReliableWorkerRegistry.getWorkerBundle('TestMainThreadService')).toBeUndefined()
    })

    it('should identify worker services correctly', () => {
      mockReliableWorkerRegistry.registerService('TestWorkerService', TestWorkerService)
      mockReliableWorkerRegistry.registerService('TestMainThreadService', TestMainThreadService)

      expect(mockReliableWorkerRegistry.isWorkerService('TestWorkerService')).toBe(true)
      expect(mockReliableWorkerRegistry.isWorkerService('TestMainThreadService')).toBe(false)
    })
  })

  describe('Service Lookup', () => {
    beforeEach(() => {
      mockReliableWorkerRegistry.registerService('TestWorkerService', TestWorkerService, '/workers/test.js')
      mockReliableWorkerRegistry.registerService('TestMainThreadService', TestMainThreadService)
    })

    it('should find registered services immediately without dynamic imports', () => {
      const serviceClass = mockReliableWorkerRegistry.getServiceClass('TestWorkerService')
      expect(serviceClass).toBe(TestWorkerService)
      expect(serviceClass.name).toBe('TestWorkerService')
    })

    it('should return undefined for unregistered services', () => {
      const serviceClass = mockReliableWorkerRegistry.getServiceClass('NonExistentService')
      expect(serviceClass).toBeUndefined()
    })

    it('should provide worker bundle URLs for worker services', () => {
      const workerBundle = mockReliableWorkerRegistry.getWorkerBundle('TestWorkerService')
      expect(workerBundle).toBe('/workers/test.js')
    })

    it('should not provide worker bundles for main thread services', () => {
      const workerBundle = mockReliableWorkerRegistry.getWorkerBundle('TestMainThreadService')
      expect(workerBundle).toBeUndefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing services gracefully', () => {
      expect(mockReliableWorkerRegistry.hasService('NonExistentService')).toBe(false)
      expect(mockReliableWorkerRegistry.getServiceClass('NonExistentService')).toBeUndefined()
      expect(mockReliableWorkerRegistry.getWorkerBundle('NonExistentService')).toBeUndefined()
      expect(mockReliableWorkerRegistry.isWorkerService('NonExistentService')).toBe(false)
    })

    it('should allow clearing the registry', () => {
      mockReliableWorkerRegistry.registerService('TestService', TestWorkerService)
      expect(mockReliableWorkerRegistry.hasService('TestService')).toBe(true)

      mockReliableWorkerRegistry.clear()
      expect(mockReliableWorkerRegistry.hasService('TestService')).toBe(false)
    })
  })

  describe('Build-time vs Runtime Behavior', () => {
    it('should not require dynamic imports or file system access', () => {
      // The registry should work entirely with pre-registered services
      mockReliableWorkerRegistry.registerService('TestWorkerService', TestWorkerService, '/workers/test.js')

      // Service lookup should be synchronous
      const start = Date.now()
      const serviceClass = mockReliableWorkerRegistry.getServiceClass('TestWorkerService')
      const end = Date.now()

      expect(serviceClass).toBe(TestWorkerService)
      expect(end - start).toBeLessThan(5) // Should be nearly instantaneous
    })

    it('should eliminate complex fallback logic', () => {
      // Unlike the current implementation with multiple path attempts,
      // this should have a single, predictable lookup
      mockReliableWorkerRegistry.registerService('TestWorkerService', TestWorkerService, '/workers/test.js')

      // No fallback paths, no try-catch blocks needed
      expect(() => {
        mockReliableWorkerRegistry.getServiceClass('TestWorkerService')
      }).not.toThrow()
    })
  })

  describe('Integration with @withWorker Decorator', () => {
    it('should work seamlessly with decorated services', () => {
      // The @withWorker decorator should have already marked the class
      expect(TestWorkerService.__isWorkerService).toBe(true)
      expect(TestWorkerService.__workerOptions).toBeDefined()
      expect(TestWorkerService.__workerOptions.name).toBe('TestWorkerService')
    })

    it('should distinguish decorated from non-decorated services', () => {
      mockReliableWorkerRegistry.registerService('TestWorkerService', TestWorkerService)
      mockReliableWorkerRegistry.registerService('TestMainThreadService', TestMainThreadService)

      expect(mockReliableWorkerRegistry.isWorkerService('TestWorkerService')).toBe(true)
      expect(mockReliableWorkerRegistry.isWorkerService('TestMainThreadService')).toBe(false)
    })
  })
})