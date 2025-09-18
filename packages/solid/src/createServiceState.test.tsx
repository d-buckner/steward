import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@solidjs/testing-library'
import { Service, ServiceContainer, createServiceToken } from '@d-buckner/steward'
import { createServiceState } from './createServiceState'
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

// Create service token for testing
const CounterToken = createServiceToken<CounterService>('counter')

describe('createServiceState', () => {
  let container: ServiceContainer

  beforeEach(() => {
    container = new ServiceContainer()
    container.register(CounterToken, CounterService)
  })

  it('should return current value for specific key', () => {
    function TestComponent() {
      const count = createServiceState(CounterToken, 'count')
      return <div data-testid="count">{count()}</div>
    }

    const { getByTestId } = render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    expect(getByTestId('count')).toHaveTextContent('0')
  })

  it('should update when service state changes', async () => {
    const service = container.resolve(CounterToken)
    
    function TestComponent() {
      const count = createServiceState(CounterToken, 'count')
      return <div data-testid="count">{count()}</div>
    }

    const { getByTestId } = render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    expect(getByTestId('count')).toHaveTextContent('0')
    
    await service.increment()
    
    expect(getByTestId('count')).toHaveTextContent('1')
  })

  it('should work with string values', async () => {
    const service = container.resolve(CounterToken)
    
    function TestComponent() {
      const name = createServiceState(CounterToken, 'name')
      return <div data-testid="name">{name()}</div>
    }

    const { getByTestId } = render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    expect(getByTestId('name')).toHaveTextContent('counter')
    
    await service.setName('updated')
    
    expect(getByTestId('name')).toHaveTextContent('updated')
  })

  it('should work with boolean values', async () => {
    const service = container.resolve(CounterToken)
    
    function TestComponent() {
      const isActive = createServiceState(CounterToken, 'isActive')
      return <div data-testid="active">{isActive() ? 'true' : 'false'}</div>
    }

    const { getByTestId } = render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    expect(getByTestId('active')).toHaveTextContent('false')
    
    await service.toggle()
    
    expect(getByTestId('active')).toHaveTextContent('true')
  })

  it('should handle rapid state changes', async () => {
    const service = container.resolve(CounterToken)
    
    function TestComponent() {
      const count = createServiceState(CounterToken, 'count')
      return <div data-testid="count">{count()}</div>
    }

    const { getByTestId } = render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    expect(getByTestId('count')).toHaveTextContent('0')
    
    await service.increment()
    await service.increment()
    await service.increment()
    
    expect(getByTestId('count')).toHaveTextContent('3')
  })
})