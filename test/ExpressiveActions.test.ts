import { describe, it, expect, beforeEach } from 'vitest'
import {
  Service,
  ServiceContainer,
  createServiceToken
} from '../src/index'

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

class ExpressiveTodoService extends Service<TodoState> {
  constructor() {
    super({
      items: [],
      filter: 'all'
    })
  }

  addItem(text: string, priority: number) {
    const current = this.state.items || []
    this.setState('items', [...current, {
      text,
      priority,
      completed: false
    }])
  }

  updateItem(index: number, text: string, priority?: number) {
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
  }

  setFilter(filter: 'all' | 'completed' | 'active') {
    this.setState('filter', filter)
  }

  toggleItem(index: number) {
    const current = this.state.items || []
    const updated = [...current]
    if (updated[index]) {
      updated[index] = {
        ...updated[index],
        completed: !updated[index].completed
      }
      this.setState('items', updated)
    }
  }

  clearAll() {
    this.setState('items', [])
  }

  assignTo(itemIndex: number, assignee: string, dueDate?: Date) {
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
  }
}

const TodoToken = createServiceToken<ExpressiveTodoService>('ExpressiveTodo')

describe('Service Actions API', () => {
  let container: ServiceContainer
  let service: ExpressiveTodoService

  beforeEach(() => {
    container = new ServiceContainer()
    container.register(TodoToken, ExpressiveTodoService)
    service = container.resolve(TodoToken)
  })

  it('should support multi-parameter actions', async () => {
    // Test sending message via service with camelCase action name
    await service.send('addItem', ['Learn Steward', 1])

    const items = service.state.items
    expect(items).toEqual([{
      text: 'Learn Steward',
      priority: 1,
      completed: false
    }])
  })

  it('should handle updateItem with optional parameters', async () => {
    // Add an item first
    await service.send('addItem', ['Original', 1])

    // Test update with all parameters
    await service.send('updateItem', [0, 'Updated text', 2])

    let items = service.state.items
    expect(items[0]).toEqual({
      text: 'Updated text',
      priority: 2,
      completed: false
    })

    // Test update without optional priority
    await service.send('updateItem', [0, 'Final text'])

    items = service.state.items
    expect(items[0]).toEqual({
      text: 'Final text',
      priority: 2, // Should keep existing priority
      completed: false
    })
  })

  it('should handle complex assignments with dates', async () => {
    // Add an item first
    await service.send('addItem', ['Important task', 3])

    const dueDate = new Date('2024-12-31')
    await service.send('assignTo', [0, 'Alice', dueDate])

    const items = service.state.items
    expect(items[0]).toEqual({
      text: 'Important task',
      priority: 3,
      completed: false,
      assignee: 'Alice',
      dueDate
    })
  })

  it('should handle simple actions', async () => {
    // Add an item first
    await service.send('addItem', ['Toggle me', 1])

    // Toggle the item
    await service.send('toggleItem', [0])

    const items = service.state.items
    expect(items[0].completed).toBe(true)

    // Clear all items
    await service.send('clearAll', [])

    expect(service.state.items).toEqual([])
  })

  it('should maintain message history with proper payloads', async () => {
    await service.send('addItem', ['Task 1', 1])
    await service.send('addItem', ['Task 2', 2])
    await service.send('setFilter', ['completed'])

    const history = service.getMessageHistory()
    expect(history).toHaveLength(3)

    expect(history[0]).toMatchObject({
      type: 'addItem',
      payload: ['Task 1', 1]
    })

    expect(history[1]).toMatchObject({
      type: 'addItem',
      payload: ['Task 2', 2]
    })

    expect(history[2]).toMatchObject({
      type: 'setFilter',
      payload: ['completed']
    })
  })
})