import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ServiceContainer } from '../src/core/ServiceContainer'
import { Service } from '../src/core/Service'
import { createServiceToken } from '../src/core/ServiceTokens'

// Simple test service
interface TestState {
  count: number
}

class TestService extends Service<TestState> {
  constructor() {
    super({ count: 0 })
  }

  increment() {
    const currentCount = this.state.count || 0
    this.setState('count', currentCount + 1)
  }
}

// Service token
const TestServiceToken = createServiceToken<TestService>('TestService')

describe('ServiceContainer', () => {
  let container: ServiceContainer

  beforeEach(() => {
    container = new ServiceContainer()
  })

  describe('Basic Registration and Resolution', () => {
    it('should register and resolve a service', () => {
      container.register(TestServiceToken, TestService)
      
      const service = container.resolve(TestServiceToken)
      
      expect(service).toBeInstanceOf(TestService)
    })

    it('should return same instance for repeated resolution', () => {
      container.register(TestServiceToken, TestService)
      
      const service1 = container.resolve(TestServiceToken)
      const service2 = container.resolve(TestServiceToken)
      
      expect(service1).toBe(service2)
    })

    it('should throw when resolving unregistered service', () => {
      const UnknownToken = createServiceToken<TestService>('Unknown')

      expect(() => container.resolve(UnknownToken)).toThrow()
    })
  })

  describe('Service Functionality', () => {
    it('should create working service instances', () => {
      container.register(TestServiceToken, TestService)
      
      const service = container.resolve(TestServiceToken)
      
      expect(service.state.count).toBe(0)
      
      service.increment()
      
      expect(service.state.count).toBe(1)
    })

    it('should maintain service state across resolutions', () => {
      container.register(TestServiceToken, TestService)
      
      const service1 = container.resolve(TestServiceToken)
      service1.increment()
      
      const service2 = container.resolve(TestServiceToken)
      
      expect(service2.state.count).toBe(1)
    })
  })

  describe('Container Cleanup', () => {
    it('should dispose services when container is disposed', () => {
      container.register(TestServiceToken, TestService)

      const service = container.resolve(TestServiceToken) as any
      const clearSpy = vi.spyOn(service, 'clear')

      container.dispose()

      expect(clearSpy).toHaveBeenCalled()
    })
  })

  describe('ServiceClient Integration', () => {
    beforeEach(() => {
      container.register(TestServiceToken, TestService)
    })

    it('should provide same API as UI packages', async () => {
      const { createServiceClient, useService } = await import('../src/headless/ServiceClient')

      // Test createServiceClient
      const client = createServiceClient(container, TestServiceToken)

      // Test state access
      expect(client.state.count).toBe(0)

      // Test destructuring state
      const { count } = client.state
      expect(count).toBe(0)

      // Test actions
      await client.actions.increment()
      expect(client.state.count).toBe(1)

      // Test destructuring actions
      const { increment } = client.actions
      await increment()
      expect(client.state.count).toBe(2)

      client.dispose()
    })

    it('should support useService convenience function', async () => {
      const { useService } = await import('../src/headless/ServiceClient')

      const { state, actions, dispose } = useService(container, TestServiceToken)

      // Same API as UI packages
      expect(state.count).toBe(0)

      const { count } = state
      const { increment } = actions

      expect(count).toBe(0)

      await increment()
      expect(state.count).toBe(1)

      dispose()
    })
  })
})