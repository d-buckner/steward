import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@solidjs/testing-library'
import { MessageService, withMessages, Message, ServiceContainer, createServiceToken } from '@d-buckner/steward'
import { createServiceActions } from './createServiceActions'
import { ServiceProvider } from './ServiceProvider'

interface TodoState {
  items: string[]
  filter: 'all' | 'completed' | 'active'
  loading: boolean
}

interface TodoMessages {
  ADD_ITEM: { text: string }
  REMOVE_ITEM: { index: number }
  SET_FILTER: { filter: 'all' | 'completed' | 'active' }
  CLEAR_ALL: {}
  LOAD_ITEMS: {}
}

@withMessages<TodoMessages>([
  'ADD_ITEM',
  'REMOVE_ITEM',
  'SET_FILTER',
  'CLEAR_ALL',
  'LOAD_ITEMS'
], {
  ADD_ITEM: (text: string) => ({ text }),
  REMOVE_ITEM: (index: number) => ({ index }),
  SET_FILTER: (filter: 'all' | 'completed' | 'active') => ({ filter }),
  CLEAR_ALL: () => ({}),
  LOAD_ITEMS: () => ({})
})
class TodoService extends MessageService<TodoState, TodoMessages> {
  constructor() {
    super({
      items: [],
      filter: 'all',
      loading: false
    })
  }

  async handle<K extends keyof TodoMessages>(
    message: Message<TodoMessages, K>
  ): Promise<void> {
    switch (message.type) {
      case 'ADD_ITEM': {
        const { text } = message.payload as TodoMessages['ADD_ITEM']
        const current = this.state.items || []
        this.setState('items', [...current, text])
        break
      }

      case 'REMOVE_ITEM': {
        const { index } = message.payload as TodoMessages['REMOVE_ITEM']
        const current = this.state.items || []
        this.setState('items', current.filter((_: string, i: number) => i !== index))
        break
      }

      case 'SET_FILTER': {
        const { filter } = message.payload as TodoMessages['SET_FILTER']
        this.setState('filter', filter)
        break
      }

      case 'CLEAR_ALL': {
        this.setState('items', [])
        break
      }

      case 'LOAD_ITEMS': {
        this.setState('loading', true)
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 10))
        this.setState('items', ['Loaded item 1', 'Loaded item 2'])
        this.setState('loading', false)
        break
      }
    }
  }
}

// Create service token for testing
const TodoToken = createServiceToken<TodoService>('todo')

describe('createServiceActions', () => {
  let container: ServiceContainer

  beforeEach(() => {
    container = new ServiceContainer()
    container.register(TodoToken, TodoService)
  })

  it('should return all service methods as actions', () => {
    function TestComponent() {
      const actions = createServiceActions(TodoToken)
      
      expect(actions).toHaveProperty('addItem')
      expect(actions).toHaveProperty('removeItem')
      expect(actions).toHaveProperty('setFilter')
      expect(actions).toHaveProperty('clearAll')
      expect(actions).toHaveProperty('loadItems')
      
      expect(typeof actions.addItem).toBe('function')
      expect(typeof actions.removeItem).toBe('function')
      expect(typeof actions.setFilter).toBe('function')
      expect(typeof actions.clearAll).toBe('function')
      expect(typeof actions.loadItems).toBe('function')
      
      return <div>test</div>
    }

    render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
  })

  it('should call service methods through actions', async () => {
    const service = container.resolve(TodoToken)
    
    function TestComponent() {
      const actions = createServiceActions(TodoToken)
      
      // Test the action by calling it
      actions.addItem('Test item')
      
      return <div>test</div>
    }

    expect(service.state.items).toEqual([])
    
    render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    
    // Allow for async state update
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(service.state.items).toEqual(['Test item'])
  })

  it('should handle multiple action calls', async () => {
    const service = container.resolve(TodoToken)
    
    function TestComponent() {
      const actions = createServiceActions(TodoToken)
      
      const handleMultipleActions = async () => {
        await actions.addItem('Item 1')
        await actions.addItem('Item 2')
        await actions.addItem('Item 3')
        await actions.removeItem(1)
      }
      
      handleMultipleActions()
      
      return <div>test</div>
    }

    render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    
    // Allow for async state updates
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(service.state.items).toEqual(['Item 1', 'Item 3'])
  })

  it('should handle actions with different parameter types', async () => {
    const service = container.resolve(TodoToken)
    
    function TestComponent() {
      const actions = createServiceActions(TodoToken)
      
      actions.setFilter('completed')
      
      return <div>test</div>
    }

    render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(service.state.filter).toBe('completed')
  })

  it('should handle async actions', async () => {
    const service = container.resolve(TodoToken)
    
    function TestComponent() {
      const actions = createServiceActions(TodoToken)
      
      const handleAsync = async () => {
        await actions.loadItems()
      }
      
      handleAsync()
      
      return <div>test</div>
    }

    expect(service.state.loading).toBe(false)
    expect(service.state.items).toEqual([])
    
    render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
    
    // Wait for async operation to complete
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(service.state.loading).toBe(false)
    expect(service.state.items).toEqual(['Loaded item 1', 'Loaded item 2'])
  })

  it('should not include private methods or properties', () => {
    function TestComponent() {
      const actions = createServiceActions(TodoToken)
      
      // Should not include inherited methods from Service base class
      expect(actions).not.toHaveProperty('setState')
      expect(actions).not.toHaveProperty('getCurrentValue')
      expect(actions).not.toHaveProperty('getState')
      expect(actions).not.toHaveProperty('on')
      expect(actions).not.toHaveProperty('emit')
      
      return <div>test</div>
    }

    render(() => 
      <ServiceProvider container={container}>
        <TestComponent />
      </ServiceProvider>
    )
  })
})