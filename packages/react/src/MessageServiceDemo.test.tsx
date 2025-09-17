import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { 
  Service, 
  ServiceContainer, 
  createServiceToken, 
  MessageService, 
  Message,
  withMessages
} from '@d-buckner/steward'
import { useServiceState, useServiceActions } from './index'
import { ServiceProvider } from './ServiceProvider'

// Define message types for a Todo service
interface TodoMessages {
  ADD_ITEM: { text: string }
  REMOVE_ITEM: { index: number }
  SET_FILTER: { filter: 'all' | 'completed' | 'active' }
  TOGGLE_ITEM: { index: number }
  CLEAR_ALL: {}
}

interface TodoState {
  items: string[]
  filter: 'all' | 'completed' | 'active'
  count: number
}

// Message-driven Todo service
@withMessages<TodoMessages>([
  'ADD_ITEM',
  'REMOVE_ITEM', 
  'SET_FILTER',
  'TOGGLE_ITEM',
  'CLEAR_ALL'
])
class TodoMessageService extends MessageService<TodoState, TodoMessages> {
  constructor() {
    super({
      items: [],
      filter: 'all',
      count: 0
    })
  }

  async handle<K extends keyof TodoMessages>(
    message: Message<TodoMessages, K>
  ): Promise<void> {
    switch (message.type) {
      case 'ADD_ITEM': {
        const { text } = message.payload as TodoMessages['ADD_ITEM']
        const current = this.state.items || []
        const updated = [...current, text]
        this.setState('items', updated)
        this.setState('count', updated.length)
        break
      }
      
      case 'REMOVE_ITEM': {
        const { index } = message.payload as TodoMessages['REMOVE_ITEM']
        const current = this.state.items || []
        const updated = current.filter((_, i) => i !== index)
        this.setState('items', updated)
        this.setState('count', updated.length)
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
        updated[index] = updated[index].endsWith(' ✓') 
          ? updated[index].replace(' ✓', '')
          : updated[index] + ' ✓'
        this.setState('items', updated)
        break
      }
      
      case 'CLEAR_ALL': {
        this.setState('items', [])
        this.setState('count', 0)
        break
      }
    }
  }
}

// Create typed service token
const TodoToken = createServiceToken<TodoMessageService>('Todo')

// Compare with traditional Service (for demonstration)
class TraditionalTodoService extends Service<TodoState> {
  constructor() {
    super({
      items: [],
      filter: 'all',
      count: 0
    })
  }

  async addItem(text: string): Promise<void> {
    const current = this.state.items || []
    const updated = [...current, text]
    this.setState('items', updated)
    this.setState('count', updated.length)
  }

  async removeItem(index: number): Promise<void> {
    const current = this.state.items || []
    const updated = current.filter((_, i) => i !== index)
    this.setState('items', updated)
    this.setState('count', updated.length)
  }

  async clearAll(): Promise<void> {
    this.setState('items', [])
    this.setState('count', 0)
  }
}

const TraditionalTodoToken = createServiceToken<TraditionalTodoService>('TraditionalTodo')

describe('Message-Driven Service with React Hooks', () => {
  let container: ServiceContainer

  beforeEach(() => {
    container = new ServiceContainer()
    container.register(TodoToken, TodoMessageService)
    container.register(TraditionalTodoToken, TraditionalTodoService)
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ServiceProvider container={container}>{children}</ServiceProvider>
  )

  it('should work with useServiceState for reactive updates', async () => {
    const { result: stateResult } = renderHook(
      () => ({
        items: useServiceState(TodoToken, 'items'),
        count: useServiceState(TodoToken, 'count'),
        filter: useServiceState(TodoToken, 'filter')
      }),
      { wrapper }
    )

    const { result: actionsResult } = renderHook(
      () => useServiceActions(TodoToken),
      { wrapper }
    )

    // Initial state
    expect(stateResult.current.items).toEqual([])
    expect(stateResult.current.count).toBe(0)
    expect(stateResult.current.filter).toBe('all')

    // Add items via message actions
    await act(async () => {
      await actionsResult.current.addItem({ text: 'Learn Steward' })
    })

    expect(stateResult.current.items).toEqual(['Learn Steward'])
    expect(stateResult.current.count).toBe(1)

    await act(async () => {
      await actionsResult.current.addItem({ text: 'Build awesome apps' })
    })

    expect(stateResult.current.items).toEqual(['Learn Steward', 'Build awesome apps'])
    expect(stateResult.current.count).toBe(2)
  })

  it('should provide camelCase action methods from message types', async () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper })

    // Check that all message types are converted to camelCase methods
    expect(typeof result.current.addItem).toBe('function')
    expect(typeof result.current.removeItem).toBe('function')
    expect(typeof result.current.setFilter).toBe('function')
    expect(typeof result.current.toggleItem).toBe('function')
    expect(typeof result.current.clearAll).toBe('function')
  })

  it('should handle complex message workflows', async () => {
    const { result: stateResult } = renderHook(
      () => ({
        items: useServiceState(TodoToken, 'items'),
        count: useServiceState(TodoToken, 'count'),
        filter: useServiceState(TodoToken, 'filter')
      }),
      { wrapper }
    )

    const { result: actionsResult } = renderHook(
      () => useServiceActions(TodoToken),
      { wrapper }
    )

    // Complex workflow: add items, toggle one, change filter, remove one
    await act(async () => {
      await actionsResult.current.addItem({ text: 'Task 1' })
      await actionsResult.current.addItem({ text: 'Task 2' })
      await actionsResult.current.addItem({ text: 'Task 3' })
    })

    expect(stateResult.current.items).toEqual(['Task 1', 'Task 2', 'Task 3'])
    expect(stateResult.current.count).toBe(3)

    await act(async () => {
      await actionsResult.current.toggleItem({ index: 1 })
    })

    expect(stateResult.current.items).toEqual(['Task 1', 'Task 2 ✓', 'Task 3'])

    await act(async () => {
      await actionsResult.current.setFilter({ filter: 'completed' })
    })

    expect(stateResult.current.filter).toBe('completed')

    await act(async () => {
      await actionsResult.current.removeItem({ index: 0 })
    })

    expect(stateResult.current.items).toEqual(['Task 2 ✓', 'Task 3'])
    expect(stateResult.current.count).toBe(2)
  })

  it('should maintain compatibility with traditional services', async () => {
    const { result: stateResult } = renderHook(
      () => ({
        items: useServiceState(TraditionalTodoToken, 'items'),
        count: useServiceState(TraditionalTodoToken, 'count')
      }),
      { wrapper }
    )

    const { result: actionsResult } = renderHook(
      () => useServiceActions(TraditionalTodoToken),
      { wrapper }
    )

    // Traditional service should still work
    await act(async () => {
      await actionsResult.current.addItem('Traditional item')
    })

    expect(stateResult.current.items).toEqual(['Traditional item'])
    expect(stateResult.current.count).toBe(1)

    await act(async () => {
      await actionsResult.current.clearAll()
    })

    expect(stateResult.current.items).toEqual([])
    expect(stateResult.current.count).toBe(0)
  })

  it('should track message history for debugging', async () => {
    const service = container.resolve(TodoToken)
    const { result: actionsResult } = renderHook(
      () => useServiceActions(TodoToken),
      { wrapper }
    )

    await act(async () => {
      await actionsResult.current.addItem({ text: 'Item 1' })
      await actionsResult.current.setFilter({ filter: 'completed' })
      await actionsResult.current.addItem({ text: 'Item 2' })
    })

    const history = service.getMessageHistory()
    expect(history).toHaveLength(3)
    expect(history[0].type).toBe('ADD_ITEM')
    expect(history[1].type).toBe('SET_FILTER')
    expect(history[2].type).toBe('ADD_ITEM')

    // Each message should have proper metadata
    history.forEach(message => {
      expect(message.id).toBeDefined()
      expect(message.timestamp).toBeDefined()
      expect(typeof message.timestamp).toBe('number')
    })
  })
})