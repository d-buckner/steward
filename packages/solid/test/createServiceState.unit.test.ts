import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Service, ServiceContainer, createServiceToken } from '@d-buckner/steward'
import { createRoot, createSignal } from 'solid-js'

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

describe('createServiceState (Unit Tests)', () => {
  let container: ServiceContainer
  let serviceClient: TestService

  beforeEach(() => {
    container = new ServiceContainer()
    container.register(TestToken, TestService)
    serviceClient = container.resolve(TestToken)
  })

  it('should subscribe to service events and create signals', () => {
    const eventSpy = vi.fn()
    serviceClient.on('count', eventSpy)

    // Trigger a state change
    serviceClient.increment()

    // Verify the subscription was called
    expect(eventSpy).toHaveBeenCalledWith(1)
  })

  it('should return state values from service.state proxy', () => {
    expect(serviceClient.state.count).toBe(0)
    expect(serviceClient.state.name).toBe('test')

    // Object.keys should work
    const keys = Object.keys(serviceClient.state)
    expect(keys).toContain('count')
    expect(keys).toContain('name')
  })

  it('should update state after service method calls', () => {
    const initialCount = serviceClient.state.count

    serviceClient.increment()

    expect(serviceClient.state.count).toBe(initialCount + 1)
  })

  it('should emit events when service state changes', () => {
    const events: Array<{key: string, value: any}> = []

    serviceClient.on('count', (value) => events.push({key: 'count', value}))
    serviceClient.on('name', (value) => events.push({key: 'name', value}))

    serviceClient.increment()
    serviceClient.setName('updated')

    expect(events).toEqual([
      {key: 'count', value: 1},
      {key: 'name', value: 'updated'}
    ])
  })

  describe('Solid Signal Integration', () => {
    it('should create signals that respond to service state changes', () => {
      createRoot(() => {
        // Create signals manually to test the pattern
        const [count, setCount] = createSignal(serviceClient.state.count)

        // Subscribe to service changes
        const subscription = serviceClient.on('count', (newValue) => {
          setCount(newValue)
        })

        // Initial value should match
        expect(count()).toBe(0)

        // Change service state
        serviceClient.increment()

        // Signal should update
        expect(count()).toBe(1)

        subscription.unsubscribe()
      })
    })

    it('should handle multiple signal updates', () => {
      createRoot(() => {
        const [count, setCount] = createSignal(serviceClient.state.count)

        serviceClient.on('count', setCount)

        expect(count()).toBe(0)

        serviceClient.increment()
        expect(count()).toBe(1)

        serviceClient.increment()
        expect(count()).toBe(2)
      })
    })
  })
})