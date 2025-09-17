import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { 
  ServiceContainer, 
  createServiceToken, 
  MessageService, 
  Message,
  withMessages,
  ActionCreators
} from '@d-buckner/steward'
import { useServiceState, useServiceActions } from './index'
import { ServiceProvider } from './ServiceProvider'

// Define message types for expressive API
interface TodoMessages {
  ADD_ITEM: { text: string; priority: number }
  UPDATE_ITEM: { index: number; text: string; priority?: number }
  SET_FILTER: { filter: 'all' | 'completed' | 'active' }
  ASSIGN_TO: { itemIndex: number; assignee: string; dueDate?: Date }
  CLEAR_ALL: {}
}

interface TodoState {
  items: Array<{
    text: string
    priority: number
    assignee?: string
    dueDate?: Date
  }>
  filter: 'all' | 'completed' | 'active'
}

// Define expressive action creators
const todoActions: ActionCreators<TodoMessages> = {
  ADD_ITEM: (text: string, priority: number) => ({ text, priority }),
  UPDATE_ITEM: (index: number, text: string, priority?: number) => ({ index, text, priority }),
  SET_FILTER: (filter: 'all' | 'completed' | 'active') => ({ filter }),
  ASSIGN_TO: (itemIndex: number, assignee: string, dueDate?: Date) => ({ 
    itemIndex, 
    assignee, 
    dueDate 
  })
  // CLEAR_ALL will use default (no params)
}

@withMessages<TodoMessages>(
  ['ADD_ITEM', 'UPDATE_ITEM', 'SET_FILTER', 'ASSIGN_TO', 'CLEAR_ALL'],
  todoActions
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
        this.setState('items', [...current, { text, priority }])
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
      
      case 'CLEAR_ALL': {
        this.setState('items', [])
        break
      }
    }
  }
}

const TodoToken = createServiceToken<ExpressiveTodoService>('ExpressiveTodo')

describe('Expressive Actions with React Hooks', () => {
  let container: ServiceContainer

  beforeEach(() => {
    container = new ServiceContainer()
    container.register(TodoToken, ExpressiveTodoService)
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ServiceProvider container={container}>{children}</ServiceProvider>
  )

  it('should provide expressive multi-parameter action methods', async () => {
    const { result: stateResult } = renderHook(
      () => ({
        items: useServiceState(TodoToken, 'items'),
        filter: useServiceState(TodoToken, 'filter')
      }),
      { wrapper }
    )

    const { result: actionsResult } = renderHook(
      () => useServiceActions(TodoToken),
      { wrapper }
    )

    // Test the expressive API - multiple parameters instead of object payload
    await act(async () => {
      // actions.addItem('text', priority) instead of { text: 'text', priority: 1 }
      await actionsResult.current.addItem('Learn Steward', 1)
      await actionsResult.current.addItem('Build awesome apps', 2)
    })

    expect(stateResult.current.items).toEqual([
      { text: 'Learn Steward', priority: 1 },
      { text: 'Build awesome apps', priority: 2 }
    ])

    // Test update with optional parameters
    await act(async () => {
      // actions.updateItem(index, text, priority?) 
      await actionsResult.current.updateItem(0, 'Master Steward', 3)
    })

    expect(stateResult.current.items?.[0]).toEqual({
      text: 'Master Steward', 
      priority: 3
    })

    // Test simple single parameter
    await act(async () => {
      // actions.setFilter(filter) instead of { filter: 'completed' }
      await actionsResult.current.setFilter('completed')
    })

    expect(stateResult.current.filter).toBe('completed')
  })

  it('should handle complex assignments with multiple parameters', async () => {
    const { result: stateResult } = renderHook(
      () => ({ items: useServiceState(TodoToken, 'items') }),
      { wrapper }
    )

    const { result: actionsResult } = renderHook(
      () => useServiceActions(TodoToken),
      { wrapper }
    )

    await act(async () => {
      await actionsResult.current.addItem('Important task', 5)
    })

    const dueDate = new Date('2024-12-31')
    
    await act(async () => {
      // actions.assignTo(itemIndex, assignee, dueDate?)
      await actionsResult.current.assignTo(0, 'Alice', dueDate)
    })

    expect(stateResult.current.items?.[0]).toEqual({
      text: 'Important task',
      priority: 5,
      assignee: 'Alice',
      dueDate
    })
  })

  it('should fall back to default behavior for actions without custom creators', async () => {
    const { result: stateResult } = renderHook(
      () => ({ items: useServiceState(TodoToken, 'items') }),
      { wrapper }
    )

    const { result: actionsResult } = renderHook(
      () => useServiceActions(TodoToken),
      { wrapper }
    )

    await act(async () => {
      await actionsResult.current.addItem('Test item', 1)
    })

    expect(stateResult.current.items).toHaveLength(1)

    await act(async () => {
      // clearAll() - no parameters (uses default behavior)
      await actionsResult.current.clearAll()
    })

    expect(stateResult.current.items).toEqual([])
  })

  it('should provide proper TypeScript inference for action methods', () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper })

    // These should all be functions with proper typing
    expect(typeof result.current.addItem).toBe('function')
    expect(typeof result.current.updateItem).toBe('function')
    expect(typeof result.current.setFilter).toBe('function')
    expect(typeof result.current.assignTo).toBe('function')
    expect(typeof result.current.clearAll).toBe('function')

    // The TypeScript compiler should enforce the correct parameter types
    // This is more of a compile-time test, but we can at least verify the methods exist
  })
})