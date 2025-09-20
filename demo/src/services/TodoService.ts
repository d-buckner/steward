import { Service, ServiceState } from '@d-buckner/steward'

export interface Todo {
  id: string
  text: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  createdAt: number
  dueDate?: Date
}

interface TodoState extends ServiceState {
  items: Todo[]
  filter: 'all' | 'active' | 'completed'
  loading: boolean
  searchQuery: string
}

export class TodoService extends Service<TodoState> {
  constructor() {
    super({
      items: [],
      filter: 'all',
      loading: false,
      searchQuery: ''
    })
  }

  addItem(text: string, priority: 'low' | 'medium' | 'high' = 'medium', dueDate?: Date) {
    const newItem: Todo = {
      id: Date.now().toString(),
      text: text.trim(),
      completed: false,
      priority,
      createdAt: Date.now(),
      dueDate
    }
    this.setState('items', [...this.state.items, newItem])
  }

  toggleItem(id: string) {
    this.setState('items', this.state.items.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ))
  }

  deleteItem(id: string) {
    this.setState('items', this.state.items.filter(item => item.id !== id))
  }

  editItem(id: string, text: string) {
    this.setState('items', this.state.items.map(item =>
      item.id === id ? { ...item, text: text.trim() } : item
    ))
  }

  setFilter(filter: 'all' | 'active' | 'completed') {
    this.setState('filter', filter)
  }

  setSearch(query: string) {
    this.setState('searchQuery', query)
  }

  clearCompleted() {
    this.setState('items', this.state.items.filter(item => !item.completed))
  }

  async loadSampleData() {
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