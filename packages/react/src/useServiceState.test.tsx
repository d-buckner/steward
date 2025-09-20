import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { Service, ServiceContainer, createServiceToken } from '@d-buckner/steward'
import { useServiceState } from './useServiceState'
import { ServiceProvider } from './ServiceProvider'

interface CounterState {
  count: number
  name: string
  isActive: boolean
}

class CounterService extends Service<CounterState> {
  constructor() {
    super({
      count: 0,
      name: 'counter',
      isActive: false
    })
  }

  async increment(): Promise<void> {
    const current = this.state.count || 0
    this.setState('count', current + 1)
  }

  async setName(name: string): Promise<void> {
    this.setState('name', name)
  }

  async toggle(): Promise<void> {
    const current = this.state.isActive || false
    this.setState('isActive', !current)
  }
}

// Create typed service token
const CounterToken = createServiceToken<CounterService>('Counter')

// Augment the ServiceToken namespace for intellisense
declare module '@d-buckner/steward' {
  namespace ServiceToken {
    export const Counter: typeof CounterToken
  }
}

describe('useServiceState', () => {
  let container: ServiceContainer
  let service: CounterService

  beforeEach(() => {
    container = new ServiceContainer()
    container.register(CounterToken, CounterService)
    service = container.resolve(CounterToken)
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ServiceProvider container={container}>{children}</ServiceProvider>
  )

  it('should return current state values', () => {
    const { result } = renderHook(() => useServiceState(CounterToken), { wrapper })

    expect(result.current.count).toBe(0)
    expect(result.current.name).toBe('counter')
    expect(result.current.isActive).toBe(false)
  })

  it('should update when service state changes', async () => {
    const { result } = renderHook(() => useServiceState(CounterToken), { wrapper })

    expect(result.current.count).toBe(0)

    await act(async () => {
      await service.increment()
    })

    expect(result.current.count).toBe(1)
  })

  it('should work with string values', async () => {
    const { result } = renderHook(() => useServiceState(CounterToken), { wrapper })

    expect(result.current.name).toBe('counter')

    await act(async () => {
      await service.setName('updated')
    })

    expect(result.current.name).toBe('updated')
  })

  it('should work with boolean values', async () => {
    const { result } = renderHook(() => useServiceState(CounterToken), { wrapper })

    expect(result.current.isActive).toBe(false)

    await act(async () => {
      await service.toggle()
    })

    expect(result.current.isActive).toBe(true)
  })

  it('should unsubscribe on unmount', async () => {
    const { result, unmount } = renderHook(() => useServiceState(CounterToken), { wrapper })

    expect(result.current.count).toBe(0)

    unmount()

    // After unmount, changes should not cause re-renders
    await service.increment()

    // We can't easily test that no re-render occurred, but we can verify
    // the service state changed without errors
    expect(service.state.count).toBe(1)
  })

  it('should handle rapid state changes', async () => {
    const { result } = renderHook(() => useServiceState(CounterToken), { wrapper })

    expect(result.current.count).toBe(0)

    await act(async () => {
      await service.increment()
      await service.increment()
      await service.increment()
    })

    expect(result.current.count).toBe(3)
  })

  it('should support destructuring assignment', () => {
    const { result } = renderHook(() => {
      const { count, name, isActive } = useServiceState(CounterToken)
      return { count, name, isActive }
    }, { wrapper })

    expect(result.current.count).toBe(0)
    expect(result.current.name).toBe('counter')
    expect(result.current.isActive).toBe(false)
  })

  it('should update destructured values when state changes', async () => {
    const { result } = renderHook(() => {
      const { count, name } = useServiceState(CounterToken)
      return { count, name }
    }, { wrapper })

    expect(result.current.count).toBe(0)
    expect(result.current.name).toBe('counter')

    await act(async () => {
      await service.increment()
      await service.setName('updated')
    })

    expect(result.current.count).toBe(1)
    expect(result.current.name).toBe('updated')
  })
})