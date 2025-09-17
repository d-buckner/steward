import { createServiceState, createServiceActions } from '@d-buckner/steward-solid'
import { createSignal, createMemo, For, Show } from 'solid-js'
import { TodoToken } from '../services'

export function TodoDemo() {
  const items = createServiceState(TodoToken, 'items')
  const filter = createServiceState(TodoToken, 'filter')
  const loading = createServiceState(TodoToken, 'loading')
  const searchQuery = createServiceState(TodoToken, 'searchQuery')
  
  const actions = createServiceActions(TodoToken)
  
  const [newTodoText, setNewTodoText] = createSignal('')
  const [newTodoPriority, setNewTodoPriority] = createSignal<'low' | 'medium' | 'high'>('medium')
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editText, setEditText] = createSignal('')
  
  // Computed values
  const filteredItems = createMemo(() => {
    const allItems = items() || []
    const currentFilter = filter()
    const query = searchQuery()?.toLowerCase() || ''
    
    let filtered = allItems
    
    // Apply filter
    if (currentFilter === 'active') {
      filtered = filtered.filter(item => !item.completed)
    } else if (currentFilter === 'completed') {
      filtered = filtered.filter(item => item.completed)
    }
    
    // Apply search
    if (query.trim()) {
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
  })
  
  const stats = createMemo(() => {
    const allItems = items() || []
    return {
      total: allItems.length,
      completed: allItems.filter(item => item.completed).length,
      active: allItems.filter(item => !item.completed).length,
      high: allItems.filter(item => item.priority === 'high').length,
      medium: allItems.filter(item => item.priority === 'medium').length,
      low: allItems.filter(item => item.priority === 'low').length,
    }
  })

  const addTodo = () => {
    const text = newTodoText().trim()
    if (!text) return
    
    actions.addItem(text, newTodoPriority())
    setNewTodoText('')
  }
  
  const startEdit = (id: string, text: string) => {
    setEditingId(id)
    setEditText(text)
  }
  
  const saveEdit = () => {
    const id = editingId()
    if (id) {
      actions.editItem(id, editText())
      setEditingId(null)
      setEditText('')
    }
  }
  
  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString()
  }
  
  const getPriorityEmoji = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴'
      case 'medium': return '🟡'
      case 'low': return '🟢'
      default: return '⚪'
    }
  }

  return (
    <div class="demo-section">
      <h2>📝 Todo Demo</h2>
      <p class="demo-description">
        Demonstrates message-driven architecture with <code>@withMessages</code> decorator,
        expressive action APIs, and complex state management.
      </p>
      
      <div class="todo-controls">
        <div class="add-todo">
          <input
            type="text"
            placeholder="Add a new todo..."
            value={newTodoText()}
            onInput={(e) => setNewTodoText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            class="todo-input"
          />
          
          <select
            value={newTodoPriority()}
            onChange={(e) => setNewTodoPriority(e.target.value as any)}
            class="priority-select"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          
          <button onClick={addTodo} class="add-btn">
            ➕ Add
          </button>
        </div>
        
        <div class="todo-actions">
          <button 
            onClick={() => actions.loadSampleData()} 
            class="load-btn"
            disabled={loading()}
          >
            {loading() ? '⏳ Loading...' : '📦 Load Sample Data'}
          </button>
          
          <button 
            onClick={() => actions.clearCompleted()} 
            class="clear-btn"
            disabled={stats().completed === 0}
          >
            🗑️ Clear Completed
          </button>
        </div>
      </div>
      
      <div class="todo-filters">
        <input
          type="text"
          placeholder="Search todos..."
          value={searchQuery() || ''}
          onInput={(e) => actions.setSearch(e.target.value)}
          class="search-input"
        />
        
        <div class="filter-buttons">
          <For each={[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'completed', label: 'Completed' }
          ]}>
            {(filterOption) => (
              <button
                class="filter-btn"
                classList={{ active: filter() === filterOption.key }}
                onClick={() => actions.setFilter(filterOption.key as any)}
              >
                {filterOption.label}
              </button>
            )}
          </For>
        </div>
      </div>
      
      <div class="todo-stats">
        <div class="stats-row">
          <span class="stat-badge">Total: {stats().total}</span>
          <span class="stat-badge">Active: {stats().active}</span>
          <span class="stat-badge">Done: {stats().completed}</span>
          <span class="stat-badge priority high">High: {stats().high}</span>
          <span class="stat-badge priority medium">Medium: {stats().medium}</span>
          <span class="stat-badge priority low">Low: {stats().low}</span>
        </div>
      </div>
      
      <div class="todo-list">
        <Show when={loading()}>
          <div class="loading-indicator">
            <div class="spinner"></div>
            <span>Loading sample data...</span>
          </div>
        </Show>
        
        <Show when={!loading() && filteredItems().length === 0}>
          <div class="empty-state">
            {(items()?.length || 0) === 0 
              ? "No todos yet. Add one above!" 
              : "No todos match your current filter."}
          </div>
        </Show>
        
        <For each={filteredItems()}>
          {(todo) => (
            <div class="todo-item" classList={{ completed: todo.completed }}>
              <div class="todo-content">
                <button
                  class="toggle-completed"
                  onClick={() => actions.toggleItem(todo.id)}
                >
                  {todo.completed ? '✅' : '⭕'}
                </button>
                
                <div class="todo-details">
                  <Show
                    when={editingId() === todo.id}
                    fallback={
                      <div class="todo-text" onClick={() => startEdit(todo.id, todo.text)}>
                        <span class="priority-indicator">
                          {getPriorityEmoji(todo.priority)}
                        </span>
                        <span class="text">{todo.text}</span>
                        {todo.dueDate && (
                          <span class="due-date">
                            📅 {formatDate(todo.dueDate)}
                          </span>
                        )}
                      </div>
                    }
                  >
                    <div class="edit-form">
                      <input
                        type="text"
                        value={editText()}
                        onInput={(e) => setEditText(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') saveEdit()
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        class="edit-input"
                        ref={(el) => el.focus()}
                      />
                      <button onClick={saveEdit} class="save-edit">✅</button>
                      <button onClick={cancelEdit} class="cancel-edit">❌</button>
                    </div>
                  </Show>
                </div>
              </div>
              
              <button
                class="delete-todo"
                onClick={() => actions.deleteItem(todo.id)}
              >
                🗑️
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}