import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Service, ServiceContainer, createServiceToken } from '@d-buckner/steward'

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

describe('Consumer API Test (What Solid Package Actually Uses)', () => {
  let container: ServiceContainer
  let service: TestService

  beforeEach(() => {
    container = new ServiceContainer()
    container.register(TestToken, TestService)
    service = container.resolve(TestToken)
  })

  it('should provide a service that consumers can call methods on', () => {
    expect(service.state.count).toBe(0)
    service.increment()
    expect(service.state.count).toBe(1)
  })

  it('should provide a service that consumers can subscribe to state changes', () => {
    const eventSpy = vi.fn()

    service.on('count', eventSpy)
    service.increment()

    expect(eventSpy).toHaveBeenCalledWith(1)
  })

  it('should provide state object that supports Object.keys', () => {
    const keys = Object.keys(service.state)
    expect(keys).toContain('count')
    expect(keys).toContain('name')
  })

  it('should simulate the exact createServiceState pattern that Solid uses', () => {
    // This is what createServiceState actually does
    const stateKeys = Object.keys(service.getState())
    expect(stateKeys).toContain('count')
    expect(stateKeys).toContain('name')

    // Simulate signal creation like createServiceState does
    const signals = new Map()

    stateKeys.forEach(key => {
      // Get initial value from service.state
      let currentValue = service.state[key]
      const setValue = (newValue: any) => {
        currentValue = newValue
      }
      const getValue = () => currentValue

      // Subscribe to service events
      const subscription = service.on(key, setValue)

      signals.set(key, { getValue, setValue, subscription })
    })

    // Test initial values
    expect(signals.get('count').getValue()).toBe(0)
    expect(signals.get('name').getValue()).toBe('test')

    // Test updates
    service.increment()

    expect(signals.get('count').getValue()).toBe(1)
  })
})