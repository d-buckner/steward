import { describe, it, expect, beforeEach } from 'vitest'
import { Service, withMessages, Message } from '../src/index'

// Define message types for a Todo service
interface TodoMessages {
  ADD_ITEM: { text: string }
  REMOVE_ITEM: { index: number }
  SET_FILTER: { filter: 'all' | 'completed' | 'active' }
  TOGGLE_ITEM: { index: number }
  LOAD_ITEMS_START: {}
  LOAD_ITEMS_SUCCESS: { items: string[] }
  LOAD_ITEMS_ERROR: { error: string }
}

interface TodoState {
  items: string[]
  filter: 'all' | 'completed' | 'active'
  loading: boolean
  error?: string
}

// Message-driven Todo service
@withMessages<TodoMessages>([
  'ADD_ITEM',
  'REMOVE_ITEM', 
  'SET_FILTER',
  'TOGGLE_ITEM',
  'LOAD_ITEMS_START',
  'LOAD_ITEMS_SUCCESS',
  'LOAD_ITEMS_ERROR'
])
class TodoService extends Service<TodoState, TodoMessages> {
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
        this.setState('items', current.filter((_, i) => i !== index))
        break
      }
      
      case 'SET_FILTER': {
        const { filter } = message.payload as TodoMessages['SET_FILTER']
        this.setState('filter', filter)
        break
      }
      
      case 'TOGGLE_ITEM': {
        const { index } = message.payload as TodoMessages['TOGGLE_ITEM']
        // For demo purposes, just mark as completed by adding " ✓"
        const current = this.state.items || []
        const updated = [...current]
        updated[index] = updated[index].endsWith(' ✓') 
          ? updated[index].replace(' ✓', '')
          : updated[index] + ' ✓'
        this.setState('items', updated)
        break
      }
      
      case 'LOAD_ITEMS_START': {
        this.setState('loading', true)
        this.setState('error', undefined)
        
        // Simulate async loading
        setTimeout(() => {
          this.send('LOAD_ITEMS_SUCCESS', { items: ['Loaded item 1', 'Loaded item 2'] }, message.correlationId)
        }, 10)
        break
      }
      
      case 'LOAD_ITEMS_SUCCESS': {
        const { items } = message.payload as TodoMessages['LOAD_ITEMS_SUCCESS']
        this.setState('items', items)
        this.setState('loading', false)
        
        // Resolve any pending requests
        if (message.correlationId) {
          this.resolveRequest('LOAD_ITEMS_SUCCESS', message.payload, message.correlationId)
        }
        break
      }
      
      case 'LOAD_ITEMS_ERROR': {
        const { error } = message.payload as TodoMessages['LOAD_ITEMS_ERROR']
        this.setState('error', error)
        this.setState('loading', false)
        break
      }
    }
  }
}

describe('Service', () => {
  let service: TodoService

  beforeEach(() => {
    service = new TodoService()
  })

  it('should handle ADD_ITEM messages', async () => {
    expect(service.state.items).toEqual([])
    
    await service.send('ADD_ITEM', { text: 'Test item' })
    
    expect(service.state.items).toEqual(['Test item'])
  })

  it('should handle multiple message types', async () => {
    await service.send('ADD_ITEM', { text: 'Item 1' })
    await service.send('ADD_ITEM', { text: 'Item 2' })
    await service.send('SET_FILTER', { filter: 'completed' })
    
    expect(service.state.items).toEqual(['Item 1', 'Item 2'])
    expect(service.state.filter).toBe('completed')
  })

  it('should handle REMOVE_ITEM messages', async () => {
    await service.send('ADD_ITEM', { text: 'Item 1' })
    await service.send('ADD_ITEM', { text: 'Item 2' })
    await service.send('ADD_ITEM', { text: 'Item 3' })
    
    await service.send('REMOVE_ITEM', { index: 1 })
    
    expect(service.state.items).toEqual(['Item 1', 'Item 3'])
  })

  it('should handle TOGGLE_ITEM messages', async () => {
    await service.send('ADD_ITEM', { text: 'Item 1' })
    await service.send('TOGGLE_ITEM', { index: 0 })
    
    expect(service.state.items).toEqual(['Item 1 ✓'])
    
    await service.send('TOGGLE_ITEM', { index: 0 })
    expect(service.state.items).toEqual(['Item 1'])
  })

  it('should track message history', async () => {
    await service.send('ADD_ITEM', { text: 'Item 1' })
    await service.send('SET_FILTER', { filter: 'completed' })
    
    const history = service.getMessageHistory()
    expect(history).toHaveLength(2)
    expect(history[0].type).toBe('ADD_ITEM')
    expect(history[1].type).toBe('SET_FILTER')
  })

  it('should support async operations with message sequences', async () => {
    expect(service.state.loading).toBe(false)
    
    await service.send('LOAD_ITEMS_START', {})
    expect(service.state.loading).toBe(true)
    
    // Wait for async completion
    await new Promise(resolve => setTimeout(resolve, 20))
    
    expect(service.state.loading).toBe(false)
    expect(service.state.items).toEqual(['Loaded item 1', 'Loaded item 2'])
  })

  it('should support request/response pattern', async () => {
    const result = await service.request(
      'LOAD_ITEMS_START',
      {},
      'LOAD_ITEMS_SUCCESS',
      1000
    )
    
    expect(result).toEqual({ items: ['Loaded item 1', 'Loaded item 2'] })
  })

  it('should emit state change events for reactive updates', async () => {
    const itemsChanges: string[][] = []
    
    service.on('items', (items) => {
      itemsChanges.push(items)
    })
    
    await service.send('ADD_ITEM', { text: 'Item 1' })
    await service.send('ADD_ITEM', { text: 'Item 2' })
    
    expect(itemsChanges).toEqual([
      ['Item 1'],   // After first add
      ['Item 1', 'Item 2']  // After second add
    ])
  })

  it('should clear pending requests on disposal', async () => {
    // Start a request but don't resolve it
    const requestPromise = service.request(
      'LOAD_ITEMS_START',
      {},
      'LOAD_ITEMS_SUCCESS'
    )
    
    // Dispose the service
    service.clear()
    
    // Request should be rejected
    await expect(requestPromise).rejects.toThrow('Service disposed')
  })
})