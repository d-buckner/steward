import { describe, it, expect, beforeEach } from 'vitest'
import { 
  MessageService, 
  Message, 
  withMessages, 
  ServiceContainer,
  createServiceToken,
  ActionCreators
} from '../src/index'

// Define message types with multi-parameter payloads
interface TodoMessages {
  ADD_ITEM: { text: string; priority: number }
  UPDATE_ITEM: { index: number; text: string; priority?: number }
  SET_FILTER: { filter: 'all' | 'completed' | 'active' }
  TOGGLE_ITEM: { index: number }
  CLEAR_ALL: {}
  ASSIGN_TO: { itemIndex: number; assignee: string; dueDate?: Date }
}

interface TodoState {
  items: Array<{
    text: string
    priority: number
    completed: boolean
    assignee?: string
    dueDate?: Date
  }>
  filter: 'all' | 'completed' | 'active'
}

// Define custom action creators for expressive API
const todoActionCreators: ActionCreators<TodoMessages> = {
  ADD_ITEM: (text: string, priority: number) => ({ text, priority }),
  UPDATE_ITEM: (index: number, text: string, priority?: number) => ({ index, text, priority }),
  SET_FILTER: (filter: 'all' | 'completed' | 'active') => ({ filter }),
  ASSIGN_TO: (itemIndex: number, assignee: string, dueDate?: Date) => ({ 
    itemIndex, 
    assignee, 
    dueDate 
  }),
  // TOGGLE_ITEM and CLEAR_ALL will use defaults
}

@withMessages<TodoMessages>(
  ['ADD_ITEM', 'UPDATE_ITEM', 'SET_FILTER', 'TOGGLE_ITEM', 'CLEAR_ALL', 'ASSIGN_TO'],
  todoActionCreators
)
class ExpressiveTodoService extends MessageService<TodoState, TodoMessages> {
  constructor() {
    super({
      items: [],
      filter: 'all'
    })
  }

  async handle<K extends keyof TodoMessages>(
    message: Message<TodoMessages, K>
  ): Promise<void> {
    switch (message.type) {
      case 'ADD_ITEM': {
        const { text, priority } = message.payload as TodoMessages['ADD_ITEM']
        const current = this.state.items || []
        this.setState('items', [...current, { 
          text, 
          priority, 
          completed: false 
        }])
        break
      }
      
      case 'UPDATE_ITEM': {
        const { index, text, priority } = message.payload as TodoMessages['UPDATE_ITEM']
        const current = this.state.items || []
        const updated = [...current]
        if (updated[index]) {
          updated[index] = { 
            ...updated[index], 
            text,
            ...(priority !== undefined && { priority })
          }
          this.setState('items', updated)
        }
        break
      }
      
      case 'SET_FILTER': {
        const { filter } = message.payload as TodoMessages['SET_FILTER']
        this.setState('filter', filter)
        break
      }
      
      case 'TOGGLE_ITEM': {
        const { index } = message.payload as TodoMessages['TOGGLE_ITEM']
        const current = this.state.items || []
        const updated = [...current]
        if (updated[index]) {
          updated[index] = { 
            ...updated[index], 
            completed: !updated[index].completed 
          }
          this.setState('items', updated)
        }
        break
      }
      
      case 'CLEAR_ALL': {
        this.setState('items', [])
        break
      }
      
      case 'ASSIGN_TO': {
        const { itemIndex, assignee, dueDate } = message.payload as TodoMessages['ASSIGN_TO']
        const current = this.state.items || []
        const updated = [...current]
        if (updated[itemIndex]) {
          updated[itemIndex] = { 
            ...updated[itemIndex], 
            assignee,
            dueDate
          }
          this.setState('items', updated)
        }
        break
      }
    }
  }
}

const TodoToken = createServiceToken<ExpressiveTodoService>('ExpressiveTodo')

describe('Expressive Action API', () => {
  let container: ServiceContainer
  let service: ExpressiveTodoService

  beforeEach(() => {
    container = new ServiceContainer()
    container.register(TodoToken, ExpressiveTodoService)
    service = container.resolve(TodoToken)
  })

  it('should support multi-parameter actions with expressive API', async () => {
    // Test the expressive API directly on service
    const messageTypes = (service as any).__messageTypes
    const actionCreators = (service as any).__actionCreators
    
    expect(messageTypes).toContain('ADD_ITEM')
    expect(actionCreators.ADD_ITEM).toBeDefined()
    
    // Test action creator function
    const addItemPayload = actionCreators.ADD_ITEM('Learn Steward', 1)
    expect(addItemPayload).toEqual({ text: 'Learn Steward', priority: 1 })
    
    // Test sending message via service
    await service.send('ADD_ITEM', addItemPayload)
    
    const items = service.state.items
    expect(items).toEqual([{
      text: 'Learn Steward',
      priority: 1,
      completed: false
    }])
  })

  it('should handle UPDATE_ITEM with optional parameters', async () => {
    const actionCreators = (service as any).__actionCreators
    
    // Add an item first
    await service.send('ADD_ITEM', { text: 'Original', priority: 1 })
    
    // Test update with all parameters
    const updatePayload1 = actionCreators.UPDATE_ITEM(0, 'Updated text', 2)
    expect(updatePayload1).toEqual({ index: 0, text: 'Updated text', priority: 2 })
    
    await service.send('UPDATE_ITEM', updatePayload1)
    
    let items = service.state.items
    expect(items[0]).toEqual({
      text: 'Updated text',
      priority: 2,
      completed: false
    })
    
    // Test update without optional priority
    const updatePayload2 = actionCreators.UPDATE_ITEM(0, 'Final text')
    expect(updatePayload2).toEqual({ index: 0, text: 'Final text', priority: undefined })
    
    await service.send('UPDATE_ITEM', updatePayload2)
    
    items = service.state.items
    expect(items[0]).toEqual({
      text: 'Final text',
      priority: 2, // Should keep existing priority
      completed: false
    })
  })

  it('should handle complex assignments with dates', async () => {
    const actionCreators = (service as any).__actionCreators
    
    // Add an item first
    await service.send('ADD_ITEM', { text: 'Important task', priority: 3 })
    
    const dueDate = new Date('2024-12-31')
    const assignPayload = actionCreators.ASSIGN_TO(0, 'Alice', dueDate)
    
    expect(assignPayload).toEqual({
      itemIndex: 0,
      assignee: 'Alice',
      dueDate
    })
    
    await service.send('ASSIGN_TO', assignPayload)
    
    const items = service.state.items
    expect(items[0]).toEqual({
      text: 'Important task',
      priority: 3,
      completed: false,
      assignee: 'Alice',
      dueDate
    })
  })

  it('should fall back to default behavior for actions without custom creators', async () => {
    // TOGGLE_ITEM should use default behavior (single payload object)
    await service.send('ADD_ITEM', { text: 'Toggle me', priority: 1 })
    
    // Default behavior expects payload object
    await service.send('TOGGLE_ITEM', { index: 0 })
    
    const items = service.state.items
    expect(items[0].completed).toBe(true)
    
    // CLEAR_ALL should use default behavior (empty payload)
    await service.send('CLEAR_ALL', {})
    
    expect(service.state.items).toEqual([])
  })

  it('should maintain message history with proper payloads', async () => {
    const actionCreators = (service as any).__actionCreators
    
    // Use action creators to build payloads
    await service.send('ADD_ITEM', actionCreators.ADD_ITEM('Task 1', 1))
    await service.send('ADD_ITEM', actionCreators.ADD_ITEM('Task 2', 2))
    await service.send('SET_FILTER', actionCreators.SET_FILTER('completed'))
    
    const history = service.getMessageHistory()
    expect(history).toHaveLength(3)
    
    expect(history[0]).toMatchObject({
      type: 'ADD_ITEM',
      payload: { text: 'Task 1', priority: 1 }
    })
    
    expect(history[1]).toMatchObject({
      type: 'ADD_ITEM',
      payload: { text: 'Task 2', priority: 2 }
    })
    
    expect(history[2]).toMatchObject({
      type: 'SET_FILTER',
      payload: { filter: 'completed' }
    })
  })
})