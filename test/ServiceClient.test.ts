import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Service, ServiceContainer, createServiceToken } from '../src/index'

interface TestServiceState {
  count: number
  name: string
}

class TestService extends Service<TestServiceState> {
  constructor() {
    super({
      count: 0,
      name: 'test'
    })
  }

  increment() {
    this.setState('count', this.state.count + 1)
  }

  setName(name: string) {
    this.setState('name', name)
  }
}

const TestToken = createServiceToken<TestService>('TestService')

describe('ServiceClient', () => {
  let container: ServiceContainer
  let serviceClient: TestService

  beforeEach(() => {
    container = new ServiceContainer()
    container.register(TestToken, TestService)
    serviceClient = container.resolve(TestToken)
  })

  describe('Event Forwarding', () => {
    it('should emit events when service state changes', async () => {
      const eventSpy = vi.fn()

      // Subscribe to count changes
      serviceClient.on('count', eventSpy)

      // Change state
      await serviceClient.increment()

      // Verify event was emitted
      expect(eventSpy).toHaveBeenCalledWith(1)
    })

    it('should emit events for string state changes', async () => {
      const eventSpy = vi.fn()

      // Subscribe to name changes
      serviceClient.on('name', eventSpy)

      // Change state
      await serviceClient.setName('updated')

      // Verify event was emitted
      expect(eventSpy).toHaveBeenCalledWith('updated')
    })

    it('should allow multiple subscribers to same event', async () => {
      const spy1 = vi.fn()
      const spy2 = vi.fn()

      serviceClient.on('count', spy1)
      serviceClient.on('count', spy2)

      await serviceClient.increment()

      expect(spy1).toHaveBeenCalledWith(1)
      expect(spy2).toHaveBeenCalledWith(1)
    })

    it('should unsubscribe properly', async () => {
      const eventSpy = vi.fn()

      const subscription = serviceClient.on('count', eventSpy)
      await serviceClient.increment()

      expect(eventSpy).toHaveBeenCalledTimes(1)

      subscription.unsubscribe()
      await serviceClient.increment()

      // Should not be called again after unsubscribe
      expect(eventSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('State Access', () => {
    it('should provide reactive state proxy', () => {
      expect(serviceClient.state.count).toBe(0)
      expect(serviceClient.state.name).toBe('test')
    })

    it('should support Object.keys() on state', () => {
      const keys = Object.keys(serviceClient.state)
      expect(keys).toContain('count')
      expect(keys).toContain('name')
    })

    it('should update state values after method calls', async () => {
      expect(serviceClient.state.count).toBe(0)

      await serviceClient.increment()

      expect(serviceClient.state.count).toBe(1)
    })
  })

  describe('Method Calls', () => {
    it('should call service methods through mailbox pattern', async () => {
      const initialCount = serviceClient.state.count

      await serviceClient.increment()

      expect(serviceClient.state.count).toBe(initialCount + 1)
    })

    it('should handle method arguments correctly', async () => {
      await serviceClient.setName('newName')

      expect(serviceClient.state.name).toBe('newName')
    })
  })
})