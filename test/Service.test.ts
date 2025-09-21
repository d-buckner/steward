import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Service } from '../src/core/Service'

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

describe('Service', () => {
  let service: TestService

  beforeEach(() => {
    service = new TestService()
  })

  describe('State Management', () => {
    it('should update internal state when setState is called', () => {
      expect(service.state.count).toBe(0)

      service.increment()

      expect(service.state.count).toBe(1)
    })

    it('should emit events when setState is called', () => {
      const eventSpy = vi.fn()

      // Subscribe directly to service's eventBus
      service.on('count', eventSpy)

      service.increment()

      expect(eventSpy).toHaveBeenCalledWith(1)
    })

    it('should emit events for multiple state changes', () => {
      const countSpy = vi.fn()
      const nameSpy = vi.fn()

      service.on('count', countSpy)
      service.on('name', nameSpy)

      service.increment()
      service.setName('updated')

      expect(countSpy).toHaveBeenCalledWith(1)
      expect(nameSpy).toHaveBeenCalledWith('updated')
    })

    it('should allow unsubscribing from events', () => {
      const eventSpy = vi.fn()

      const subscription = service.on('count', eventSpy)
      service.increment()

      expect(eventSpy).toHaveBeenCalledTimes(1)

      subscription.unsubscribe()
      service.increment()

      expect(eventSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Message Handling', () => {
    it('should handle messages through send() method', () => {
      expect(service.state.count).toBe(0)

      service.send('increment', [])

      expect(service.state.count).toBe(1)
    })

    it('should emit events when methods are called via send()', () => {
      const eventSpy = vi.fn()

      service.on('count', eventSpy)
      service.send('increment', [])

      expect(eventSpy).toHaveBeenCalledWith(1)
    })
  })
})