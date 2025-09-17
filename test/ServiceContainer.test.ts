import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ServiceContainer } from '../src/core/ServiceContainer'
import { Service } from '../src/core/Service'

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
const TestServiceToken = Symbol('TestService')

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
      const UnknownToken = Symbol('Unknown')
      
      expect(() => container.resolve(UnknownToken)).toThrow()
    })
  })

  describe('Service Functionality', () => {
    it('should create working service instances', () => {
      container.register(TestServiceToken, TestService)
      
      const service = container.resolve<TestService>(TestServiceToken)
      
      expect(service.state.count).toBe(0)
      
      service.increment()
      
      expect(service.state.count).toBe(1)
    })

    it('should maintain service state across resolutions', () => {
      container.register(TestServiceToken, TestService)
      
      const service1 = container.resolve<TestService>(TestServiceToken)
      service1.increment()
      
      const service2 = container.resolve<TestService>(TestServiceToken)
      
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
})