import { MessageService, withMessages, Message } from '@d-buckner/steward'

export interface Todo {
  id: string
  text: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  createdAt: number
  dueDate?: Date
}

interface TodoState {
  items: Todo[]
  filter: 'all' | 'active' | 'completed'
  loading: boolean
  searchQuery: string
}

interface TodoMessages {
  ADD_ITEM: { text: string; priority: 'low' | 'medium' | 'high'; dueDate?: Date }
  TOGGLE_ITEM: { id: string }
  DELETE_ITEM: { id: string }
  EDIT_ITEM: { id: string; text: string }
  SET_FILTER: { filter: 'all' | 'active' | 'completed' }
  SET_SEARCH: { query: string }
  CLEAR_COMPLETED: {}
  LOAD_SAMPLE_DATA: {}
}

@withMessages<TodoMessages>([
  'ADD_ITEM',
  'TOGGLE_ITEM', 
  'DELETE_ITEM',
  'EDIT_ITEM',
  'SET_FILTER',
  'SET_SEARCH',
  'CLEAR_COMPLETED',
  'LOAD_SAMPLE_DATA'
], {
  ADD_ITEM: (text: string, priority: 'low' | 'medium' | 'high' = 'medium', dueDate?: Date) => ({ text, priority, dueDate }),
  TOGGLE_ITEM: (id: string) => ({ id }),
  DELETE_ITEM: (id: string) => ({ id }),
  EDIT_ITEM: (id: string, text: string) => ({ id, text }),
  SET_FILTER: (filter: 'all' | 'active' | 'completed') => ({ filter }),
  SET_SEARCH: (query: string) => ({ query }),
  CLEAR_COMPLETED: () => ({}),
  LOAD_SAMPLE_DATA: () => ({})
})
export class TodoService extends MessageService<TodoState, TodoMessages> {
  constructor() {
    super({
      items: [],
      filter: 'all',
      loading: false,
      searchQuery: ''
    })
  }

  async handle<K extends keyof TodoMessages>(
    message: Message<TodoMessages, K>
  ): Promise<void> {
    switch (message.type) {
      case 'ADD_ITEM': {
        const { text, priority, dueDate } = message.payload as TodoMessages['ADD_ITEM']
        const newItem: Todo = {
          id: Date.now().toString(),
          text: text.trim(),
          completed: false,
          priority,
          createdAt: Date.now(),
          dueDate
        }
        this.setState('items', [...this.state.items, newItem])
        break
      }

      case 'TOGGLE_ITEM': {
        const { id } = message.payload as TodoMessages['TOGGLE_ITEM']
        this.setState('items', this.state.items.map(item =>
          item.id === id ? { ...item, completed: !item.completed } : item
        ))
        break
      }

      case 'DELETE_ITEM': {
        const { id } = message.payload as TodoMessages['DELETE_ITEM']
        this.setState('items', this.state.items.filter(item => item.id !== id))
        break
      }

      case 'EDIT_ITEM': {
        const { id, text } = message.payload as TodoMessages['EDIT_ITEM']
        this.setState('items', this.state.items.map(item =>
          item.id === id ? { ...item, text: text.trim() } : item
        ))
        break
      }

      case 'SET_FILTER': {
        const { filter } = message.payload as TodoMessages['SET_FILTER']
        this.setState('filter', filter)
        break
      }

      case 'SET_SEARCH': {
        const { query } = message.payload as TodoMessages['SET_SEARCH']
        this.setState('searchQuery', query)
        break
      }

      case 'CLEAR_COMPLETED': {
        this.setState('items', this.state.items.filter(item => !item.completed))
        break
      }

      case 'LOAD_SAMPLE_DATA': {
        this.setState('loading', true)
        
        // Simulate async loading
        await new Promise(resolve => setTimeout(resolve, 800))
        
        const sampleTodos: Todo[] = [
          {
            id: '1',
            text: 'Learn Steward library',
            completed: true,
            priority: 'high',
            createdAt: Date.now() - 86400000
          },
          {
            id: '2', 
            text: 'Build awesome SolidJS app',
            completed: false,
            priority: 'high',
            createdAt: Date.now() - 3600000,
            dueDate: new Date(Date.now() + 86400000 * 3)
          },
          {
            id: '3',
            text: 'Try message-driven architecture',
            completed: false,
            priority: 'medium',
            createdAt: Date.now() - 1800000
          },
          {
            id: '4',
            text: 'Explore strongly typed state proxy',
            completed: false,
            priority: 'low',
            createdAt: Date.now() - 900000
          }
        ]
        
        this.setState('items', sampleTodos)
        this.setState('loading', false)
        break
      }
    }
  }

  // Computed properties using strongly typed state access
  getFilteredItems() {
    const { items, filter, searchQuery } = this.state
    
    let filtered = items
    
    // Apply filter
    if (filter === 'active') {
      filtered = filtered.filter(item => !item.completed)
    } else if (filter === 'completed') {
      filtered = filtered.filter(item => item.completed)
    }
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item => 
        item.text.toLowerCase().includes(query)
      )
    }
    
    return filtered.sort((a, b) => {
      // Sort by priority, then by creation date
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return b.createdAt - a.createdAt
    })
  }

  getStats() {
    const { items } = this.state
    return {
      total: items.length,
      completed: items.filter(item => item.completed).length,
      active: items.filter(item => !item.completed).length,
      overdue: items.filter(item => 
        !item.completed && 
        item.dueDate && 
        item.dueDate.getTime() < Date.now()
      ).length
    }
  }

}