import { describe, it, expect, beforeEach } from 'vitest'
import { Service } from '@d-buckner/steward'
import { createServiceActions } from './createServiceActions'

interface TodoState {
  items: string[]
  filter: 'all' | 'completed' | 'active'
  loading: boolean
}

class TodoService extends Service<TodoState> {
  constructor() {
    super({
      items: [],
      filter: 'all',
      loading: false
    })
  }

  async addItem(text: string): Promise<void> {
    const current = this.state.items || []
    this.setState('items', [...current, text])
  }

  async removeItem(index: number): Promise<void> {
    const current = this.state.items || []
    this.setState('items', current.filter((_: string, i: number) => i !== index))
  }

  async setFilter(filter: 'all' | 'completed' | 'active'): Promise<void> {
    this.setState('filter', filter)
  }

  async clearAll(): Promise<void> {
    this.setState('items', [])
  }

  async loadItems(): Promise<void> {
    this.setState('loading', true)
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 10))
    this.setState('items', ['Loaded item 1', 'Loaded item 2'])
    this.setState('loading', false)
  }
}

describe('createServiceActions', () => {
  let service: TodoService

  beforeEach(() => {
    service = new TodoService()
  })

  it('should return all service methods as actions', () => {
    const actions = createServiceActions(service)
    
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
  })

  it('should call service methods through actions', async () => {
    const actions = createServiceActions(service)
    
    expect(service.state.items).toEqual([])
    
    await actions.addItem('Test item')
    
    expect(service.state.items).toEqual(['Test item'])
  })

  it('should handle multiple action calls', async () => {
    const actions = createServiceActions(service)
    
    await actions.addItem('Item 1')
    await actions.addItem('Item 2')
    await actions.addItem('Item 3')
    
    expect(service.state.items).toEqual(['Item 1', 'Item 2', 'Item 3'])
    
    await actions.removeItem(1)
    
    expect(service.state.items).toEqual(['Item 1', 'Item 3'])
  })

  it('should handle actions with different parameter types', async () => {
    const actions = createServiceActions(service)
    
    await actions.setFilter('completed')
    
    expect(service.state.filter).toBe('completed')
  })

  it('should handle async actions', async () => {
    const actions = createServiceActions(service)
    
    expect(service.state.loading).toBe(false)
    expect(service.state.items).toEqual([])
    
    await actions.loadItems()
    
    expect(service.state.loading).toBe(false)
    expect(service.state.items).toEqual(['Loaded item 1', 'Loaded item 2'])
  })

  it('should not include private methods or properties', () => {
    const actions = createServiceActions(service)
    
    // Should not include inherited methods from Service base class
    expect(actions).not.toHaveProperty('setState')
    expect(actions).not.toHaveProperty('getCurrentValue')
    expect(actions).not.toHaveProperty('getCurrentState')
    expect(actions).not.toHaveProperty('on')
    expect(actions).not.toHaveProperty('emit')
  })
})