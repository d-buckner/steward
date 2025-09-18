import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@solidjs/testing-library'
import { Service, ServiceContainer, createServiceToken, withMessages, Message } from '@d-buckner/steward'
import { createServiceState } from './createServiceState'
import { createServiceActions } from './createServiceActions'
import { ServiceProvider } from './ServiceProvider'

interface CounterState {
  count: number
  name: string
  isActive: boolean
}

interface CounterMessages {
  INCREMENT: {}
  SET_NAME: { name: string }
  TOGGLE: {}
}

@withMessages<CounterMessages>([
  'INCREMENT', 'SET_NAME', 'TOGGLE'
], {
  INCREMENT: () => ({}),
  SET_NAME: (name: string) => ({ name }),
  TOGGLE: () => ({})
})
class CounterService extends Service<CounterState, CounterMessages> {
  constructor() {
    super({
      count: 0,
      name: 'counter',
      isActive: false
    })
  }

  async handle<K extends keyof CounterMessages>(message: Message<CounterMessages, K>): Promise<void> {
    switch (message.type) {
      case 'INCREMENT': {
        const current = this.state.count || 0
        this.setState('count', current + 1)
        break
      }
      case 'SET_NAME': {
        const { name } = message.payload as CounterMessages['SET_NAME']
        this.setState('name', name)
        break
      }
      case 'TOGGLE': {
        const current = this.state.isActive || false
        this.setState('isActive', !current)
        break
      }
    }
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
    function TestComponent() {
      const count = createServiceState(CounterToken, 'count')
      const actions = createServiceActions(CounterToken)
      
      // Trigger action to test state update
      setTimeout(() => actions.increment(), 0)
      
      return <div data-testid="count">{count()}</div>
    }

    const { getByTestId } = render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    expect(getByTestId('count')).toHaveTextContent('0')
    
    // Wait for async action
    await new Promise(resolve => setTimeout(resolve, 10))
    
    expect(getByTestId('count')).toHaveTextContent('1')
  })

  it('should work with string values', async () => {
    function TestComponent() {
      const name = createServiceState(CounterToken, 'name')
      const actions = createServiceActions(CounterToken)
      
      // Trigger action to test state update
      setTimeout(() => actions.setName('updated'), 0)
      
      return <div data-testid="name">{name()}</div>
    }

    const { getByTestId } = render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    expect(getByTestId('name')).toHaveTextContent('counter')
    
    // Wait for async action
    await new Promise(resolve => setTimeout(resolve, 10))
    
    expect(getByTestId('name')).toHaveTextContent('updated')
  })

  it('should work with boolean values', async () => {
    function TestComponent() {
      const isActive = createServiceState(CounterToken, 'isActive')
      const actions = createServiceActions(CounterToken)
      
      // Trigger action to test state update
      setTimeout(() => actions.toggle(), 0)
      
      return <div data-testid="active">{isActive() ? 'true' : 'false'}</div>
    }

    const { getByTestId } = render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    expect(getByTestId('active')).toHaveTextContent('true')
    
    // Wait for async action  
    await new Promise(resolve => setTimeout(resolve, 10))
    
    expect(getByTestId('active')).toHaveTextContent('false')
  })

  it('should handle rapid state changes', async () => {
    function TestComponent() {
      const count = createServiceState(CounterToken, 'count')
      const actions = createServiceActions(CounterToken)
      
      // Trigger multiple actions
      setTimeout(async () => {
        await actions.increment()
        await actions.increment() 
        await actions.increment()
      }, 0)
      
      return <div data-testid="count">{count()}</div>
    }

    const { getByTestId } = render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    expect(getByTestId('count')).toHaveTextContent('0')
    
    // Wait for async actions
    await new Promise(resolve => setTimeout(resolve, 50))
    
    expect(getByTestId('count')).toHaveTextContent('3')
  })
})