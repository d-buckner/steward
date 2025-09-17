import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { Service, ServiceContainer, createServiceToken } from '@d-buckner/steward'
import { useServiceActions } from './useServiceActions'
import { ServiceProvider } from './ServiceProvider'

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

// Create typed service token
const TodoToken = createServiceToken<TodoService>('Todo')

// Augment the ServiceToken namespace for intellisense
declare module '@d-buckner/steward' {
  namespace ServiceToken {
    export const Todo: typeof TodoToken
  }
}

describe('useServiceActions', () => {
  let container: ServiceContainer
  let service: TodoService

  beforeEach(() => {
    container = new ServiceContainer()
    container.register(TodoToken, TodoService)
    service = container.resolve(TodoToken)
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ServiceProvider container={container}>{children}</ServiceProvider>
  )

  it('should return all service methods as actions', () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper })
    
    expect(result.current).toHaveProperty('addItem')
    expect(result.current).toHaveProperty('removeItem')
    expect(result.current).toHaveProperty('setFilter')
    expect(result.current).toHaveProperty('clearAll')
    expect(result.current).toHaveProperty('loadItems')
    
    expect(typeof result.current.addItem).toBe('function')
    expect(typeof result.current.removeItem).toBe('function')
    expect(typeof result.current.setFilter).toBe('function')
    expect(typeof result.current.clearAll).toBe('function')
    expect(typeof result.current.loadItems).toBe('function')
  })

  it('should call service methods through actions', async () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper })
    
    expect(service.state.items).toEqual([])
    
    await act(async () => {
      await result.current.addItem('Test item')
    })
    
    expect(service.state.items).toEqual(['Test item'])
  })

  it('should handle multiple action calls', async () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper })
    
    await act(async () => {
      await result.current.addItem('Item 1')
      await result.current.addItem('Item 2')
      await result.current.addItem('Item 3')
    })
    
    expect(service.state.items).toEqual(['Item 1', 'Item 2', 'Item 3'])
    
    await act(async () => {
      await result.current.removeItem(1)
    })
    
    expect(service.state.items).toEqual(['Item 1', 'Item 3'])
  })

  it('should handle actions with different parameter types', async () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper })
    
    await act(async () => {
      await result.current.setFilter('completed')
    })
    
    expect(service.state.filter).toBe('completed')
  })

  it('should handle async actions', async () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper })
    
    expect(service.state.loading).toBe(false)
    expect(service.state.items).toEqual([])
    
    await act(async () => {
      await result.current.loadItems()
    })
    
    expect(service.state.loading).toBe(false)
    expect(service.state.items).toEqual(['Loaded item 1', 'Loaded item 2'])
  })

  it('should not include private methods or properties', () => {
    const { result } = renderHook(() => useServiceActions(TodoToken), { wrapper })
    
    // Should not include inherited methods from Service base class
    expect(result.current).not.toHaveProperty('setState')
    expect(result.current).not.toHaveProperty('getCurrentValue')
    expect(result.current).not.toHaveProperty('getCurrentState')
    expect(result.current).not.toHaveProperty('on')
    expect(result.current).not.toHaveProperty('emit')
  })

  it('should return stable references across re-renders', () => {
    const { result, rerender } = renderHook(() => useServiceActions(TodoToken), { wrapper })
    
    const firstActions = result.current
    
    rerender()
    
    const secondActions = result.current
    
    expect(firstActions).toBe(secondActions)
  })
})