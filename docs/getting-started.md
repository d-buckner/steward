# Getting Started with Steward

Let's build something together. We'll start with a simple counter, then progressively add complexity to show how Steward's service architecture grows with your needs. By the end, you'll understand how to build applications that can seamlessly scale from local state management to distributed, worker-based processing.

## The Journey Ahead

We're going to build the same todo application three different ways:

1. **Basic Service**: Start with simple, local state management
2. **Message-Driven Service**: Add structured communication and debugging capabilities
3. **Worker Service**: Move CPU-intensive work to a Web Worker with zero code changes

Each step builds on the previous one, showing how Steward lets you evolve your architecture without rewriting existing code.

## Installation

First, let's get the packages we need:

```bash
npm install @d-buckner/steward @steward/react
```

## Step 1: Your First Service

Let's start with something familiar - a counter. But instead of useState, we'll build it as a service:

```typescript
// services/CounterService.ts
import { Service, createServiceToken, ServiceState } from '@d-buckner/steward'

interface CounterState extends ServiceState {
  count: number
  step: number
  history: number[]
}

class CounterService extends Service<CounterState> {
  constructor() {
    super({
      count: 0,
      step: 1,
      history: [0]
    })
  }

  // Every service must implement this abstract method
  handle() {
    // We'll use this later for message handling
  }

  // These are just regular methods that update state
  increment() {
    const newCount = this.state.count + this.state.step
    this.setState('count', newCount)
    this.setState('history', [...this.state.history, newCount])
  }

  decrement() {
    const newCount = this.state.count - this.state.step
    this.setState('count', newCount)
    this.setState('history', [...this.state.history, newCount])
  }

  setStep(step: number) {
    this.setState('step', Math.max(1, Math.min(10, step)))
  }

  reset() {
    this.setState('count', 0)
    this.setState('history', [0])
  }
}

export const CounterToken = createServiceToken<CounterService>('counter')
```

Notice how this looks similar to a React component with useState, but the state management is centralized in the service. The `createServiceToken` gives us a typed reference we can use throughout our app.

## Step 2: Connecting to React

Now let's wire this up to a React component:

```tsx
// App.tsx
import React from 'react'
import { ServiceContainer } from '@d-buckner/steward'
import { ServiceProvider } from '@steward/react'
import { CounterToken, CounterService } from './services/CounterService'
import { Counter } from './components/Counter'

// Set up the service container
const container = new ServiceContainer()
container.register(CounterToken, CounterService)

function App() {
  return (
    <ServiceProvider container={container}>
      <div className="app">
        <h1>Steward Counter Demo</h1>
        <Counter />
      </div>
    </ServiceProvider>
  )
}

export default App
```

```tsx
// components/Counter.tsx
import React from 'react'
import { useServiceState, useServiceActions } from '@steward/react'
import { CounterToken } from '../services/CounterService'

export function Counter() {
  // Subscribe to specific pieces of state
  const count = useServiceState(CounterToken, 'count')
  const step = useServiceState(CounterToken, 'step')
  const history = useServiceState(CounterToken, 'history')

  // Get all the service methods as actions
  const actions = useServiceActions(CounterToken)

  return (
    <div className="counter">
      <h2>Count: {count}</h2>

      <div className="controls">
        <button onClick={actions.decrement}>-{step}</button>
        <button onClick={actions.increment}>+{step}</button>
        <button onClick={actions.reset}>Reset</button>
      </div>

      <div className="step-control">
        <label>
          Step size:
          <input
            type="number"
            value={step}
            onChange={(e) => actions.setStep(Number(e.target.value))}
            min="1"
            max="10"
          />
        </label>
      </div>

      <div className="history">
        <p>History ({history.length} entries):</p>
        <div className="history-values">
          {history.slice(-10).map((value, index) => (
            <span key={index} className="history-item">
              {value}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
```

At this point, you might be wondering why we're not just using useState. The service pattern gives us a few advantages even at this simple level:

- **Centralized state**: All counter logic lives in one place
- **Easy testing**: Services can be tested in isolation
- **Reusability**: The same service can be used by multiple components
- **Foundation for scaling**: We can add messaging and workers later

## Step 3: Adding Message-Driven Architecture

Now let's build something more complex - a todo application that uses Steward's message-driven architecture. This is where things get interesting.

```typescript
// services/TodoService.ts
import { Service, withMessages, Message, createServiceToken, ServiceState, ServiceMessages } from '@d-buckner/steward'

export interface Todo {
  id: string
  text: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  createdAt: number
}

interface TodoState extends ServiceState {
  items: Todo[]
  filter: 'all' | 'active' | 'completed'
  loading: boolean
}

interface TodoMessages extends ServiceMessages {
  ADD_ITEM: { text: string; priority: 'low' | 'medium' | 'high' }
  TOGGLE_ITEM: { id: string }
  DELETE_ITEM: { id: string }
  EDIT_ITEM: { id: string; text: string }
  SET_FILTER: { filter: 'all' | 'active' | 'completed' }
  CLEAR_COMPLETED: {}
  LOAD_SAMPLE_DATA: {}
}

@withMessages<TodoMessages>([
  'ADD_ITEM',
  'TOGGLE_ITEM',
  'DELETE_ITEM',
  'EDIT_ITEM',
  'SET_FILTER',
  'CLEAR_COMPLETED',
  'LOAD_SAMPLE_DATA'
], {
  // These action creators give us a better developer experience
  ADD_ITEM: (text: string, priority: 'low' | 'medium' | 'high' = 'medium') => ({ text, priority }),
  TOGGLE_ITEM: (id: string) => ({ id }),
  DELETE_ITEM: (id: string) => ({ id }),
  EDIT_ITEM: (id: string, text: string) => ({ id, text }),
  SET_FILTER: (filter: 'all' | 'active' | 'completed') => ({ filter }),
  CLEAR_COMPLETED: () => ({}),
  LOAD_SAMPLE_DATA: () => ({})
})
export class TodoService extends Service<TodoState, TodoMessages> {
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
        const { text, priority } = message.payload as TodoMessages['ADD_ITEM']
        const newItem: Todo = {
          id: Date.now().toString(),
          text: text.trim(),
          completed: false,
          priority,
          createdAt: Date.now()
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

      case 'CLEAR_COMPLETED': {
        this.setState('items', this.state.items.filter(item => !item.completed))
        break
      }

      case 'LOAD_SAMPLE_DATA': {
        this.setState('loading', true)

        // Simulate async data loading
        await new Promise(resolve => setTimeout(resolve, 1000))

        const sampleTodos: Todo[] = [
          {
            id: '1',
            text: 'Learn Steward framework',
            completed: true,
            priority: 'high',
            createdAt: Date.now() - 86400000
          },
          {
            id: '2',
            text: 'Build something awesome with message-driven architecture',
            completed: false,
            priority: 'high',
            createdAt: Date.now() - 3600000
          },
          {
            id: '3',
            text: 'Explore worker-based performance optimization',
            completed: false,
            priority: 'medium',
            createdAt: Date.now() - 1800000
          }
        ]

        this.setState('items', sampleTodos)
        this.setState('loading', false)
        break
      }
    }
  }

  // We can add computed properties that use the reactive state
  getFilteredItems() {
    const { items, filter } = this.state

    switch (filter) {
      case 'active':
        return items.filter(item => !item.completed)
      case 'completed':
        return items.filter(item => item.completed)
      default:
        return items
    }
  }

  getStats() {
    const { items } = this.state
    return {
      total: items.length,
      completed: items.filter(item => item.completed).length,
      active: items.filter(item => !item.completed).length
    }
  }
}

export const TodoToken = createServiceToken<TodoService>('todos')
```

The message-driven approach gives us several benefits:

- **Structured communication**: Every action is a well-defined message
- **Debugging**: We can inspect message history and replay actions
- **Time travel**: Message history enables undo/redo functionality
- **Testing**: We can test by sending messages and inspecting state changes

## Step 4: Using the Todo Service

The React component looks very similar to our counter:

```tsx
// components/TodoApp.tsx
import React from 'react'
import { useServiceState, useServiceActions } from '@steward/react'
import { TodoToken } from '../services/TodoService'

export function TodoApp() {
  const items = useServiceState(TodoToken, 'items')
  const filter = useServiceState(TodoToken, 'filter')
  const loading = useServiceState(TodoToken, 'loading')
  const actions = useServiceActions(TodoToken)

  const filteredItems = React.useMemo(() => {
    switch (filter) {
      case 'active':
        return items.filter(item => !item.completed)
      case 'completed':
        return items.filter(item => item.completed)
      default:
        return items
    }
  }, [items, filter])

  return (
    <div className="todo-app">
      <header>
        <h1>Todos ({items.length})</h1>
        <div className="controls">
          <button
            onClick={() => actions.addItem('New task', 'medium')}
            disabled={loading}
          >
            Add Task
          </button>
          <button onClick={actions.loadSampleData} disabled={loading}>
            Load Sample Data
          </button>
          <button onClick={actions.clearCompleted}>
            Clear Completed
          </button>
        </div>
      </header>

      <div className="filters">
        {(['all', 'active', 'completed'] as const).map(filterType => (
          <button
            key={filterType}
            className={filter === filterType ? 'active' : ''}
            onClick={() => actions.setFilter(filterType)}
          >
            {filterType}
          </button>
        ))}
      </div>

      {loading && <div className="loading">Loading todos...</div>}

      <div className="todo-list">
        {filteredItems.map(item => (
          <div key={item.id} className={`todo-item ${item.completed ? 'completed' : ''}`}>
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => actions.toggleItem(item.id)}
            />
            <span className="text">{item.text}</span>
            <span className={`priority priority-${item.priority}`}>
              {item.priority}
            </span>
            <button onClick={() => actions.deleteItem(item.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Notice how the component doesn't know or care that it's talking to a message-driven service. The `useServiceActions` hook automatically creates action methods from our message definitions.

## Step 5: Scaling to Web Workers

Here's where Steward really shines. Let's say our todo processing becomes CPU-intensive - maybe we're handling thousands of items, or doing complex filtering and sorting. We can move the entire service to a Web Worker without changing any other code.

```typescript
// services/DataProcessingService.ts
import { Service, withMessages, withWorker, Message, createServiceToken, ServiceState, ServiceMessages } from '@d-buckner/steward'

interface DataProcessingState extends ServiceState {
  isProcessing: boolean
  progress: number
  result: number | null
  processedItems: number
  totalItems: number
}

interface DataProcessingMessages extends ServiceMessages {
  START_PROCESSING: { items: number[]; operation: 'sum' | 'fibonacci' | 'prime_count' }
  CANCEL_PROCESSING: {}
  RESET: {}
}

// This decorator moves the entire service to a Web Worker
@withWorker({ name: 'DataProcessor' })
@withMessages<DataProcessingMessages>([
  'START_PROCESSING', 'CANCEL_PROCESSING', 'RESET'
], {
  START_PROCESSING: (items: number[], operation: 'sum' | 'fibonacci' | 'prime_count') => ({ items, operation }),
  CANCEL_PROCESSING: () => ({}),
  RESET: () => ({})
})
export class DataProcessingService extends Service<DataProcessingState, DataProcessingMessages> {
  private cancelProcessing = false

  constructor() {
    super({
      isProcessing: false,
      progress: 0,
      result: null,
      processedItems: 0,
      totalItems: 0
    })
  }

  async handle<K extends keyof DataProcessingMessages>(message: Message<DataProcessingMessages, K>): Promise<void> {
    switch (message.type) {
      case 'START_PROCESSING': {
        const { items, operation } = message.payload as DataProcessingMessages['START_PROCESSING']
        await this.processData(items, operation)
        break
      }

      case 'CANCEL_PROCESSING': {
        this.cancelProcessing = true
        this.setState('isProcessing', false)
        break
      }

      case 'RESET': {
        this.cancelProcessing = false
        this.setStates({
          isProcessing: false,
          progress: 0,
          result: null,
          processedItems: 0,
          totalItems: 0
        })
        break
      }
    }
  }

  private async processData(items: number[], operation: string): Promise<void> {
    if (this.state.isProcessing) return

    this.cancelProcessing = false
    this.setStates({
      isProcessing: true,
      progress: 0,
      result: null,
      processedItems: 0,
      totalItems: items.length
    })

    let result = 0
    const batchSize = Math.max(1, Math.floor(items.length / 100))

    for (let i = 0; i < items.length; i++) {
      if (this.cancelProcessing) return

      const item = items[i]

      // CPU-intensive operations
      switch (operation) {
        case 'sum':
          result += item
          break
        case 'fibonacci':
          result += this.fibonacci(item % 35)
          break
        case 'prime_count':
          result += this.countPrimesUpTo(item % 1000)
          break
      }

      // Update progress periodically to keep the UI responsive
      if (i % batchSize === 0 || i === items.length - 1) {
        const progress = (i + 1) / items.length
        this.setStates({
          progress,
          processedItems: i + 1
        })

        // Yield control back to the event loop
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }

    this.setStates({
      isProcessing: false,
      result,
      progress: 1
    })
  }

  private fibonacci(n: number): number {
    if (n <= 1) return n
    let a = 0, b = 1
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b]
    }
    return b
  }

  private countPrimesUpTo(n: number): number {
    if (n < 2) return 0

    const sieve = new Array(n + 1).fill(true)
    sieve[0] = sieve[1] = false

    for (let i = 2; i * i <= n; i++) {
      if (sieve[i]) {
        for (let j = i * i; j <= n; j += i) {
          sieve[j] = false
        }
      }
    }

    return sieve.filter(Boolean).length
  }
}

export const DataProcessingToken = createServiceToken<DataProcessingService>('dataProcessing')
```

## Step 6: Using Worker Services

The remarkable thing is that our React components don't need to change at all:

```tsx
// components/DataProcessingDemo.tsx
import React from 'react'
import { useServiceState, useServiceActions } from '@steward/react'
import { DataProcessingToken } from '../services/DataProcessingService'

export function DataProcessingDemo() {
  const isProcessing = useServiceState(DataProcessingToken, 'isProcessing')
  const progress = useServiceState(DataProcessingToken, 'progress')
  const result = useServiceState(DataProcessingToken, 'result')
  const processedItems = useServiceState(DataProcessingToken, 'processedItems')
  const totalItems = useServiceState(DataProcessingToken, 'totalItems')

  const actions = useServiceActions(DataProcessingToken)

  const startHeavyProcessing = () => {
    // Generate a million numbers for processing
    const items = Array.from({ length: 1000000 }, () => Math.floor(Math.random() * 100))
    actions.startProcessing(items, 'prime_count')
  }

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '—'
    return num.toLocaleString()
  }

  return (
    <div className="data-processing">
      <h2>CPU-Intensive Processing</h2>
      <p className="description">
        This service runs in a Web Worker, keeping the main thread responsive
        even during heavy computation.
      </p>

      <div className="controls">
        <button
          onClick={startHeavyProcessing}
          disabled={isProcessing}
        >
          Process 1M Items (Prime Count)
        </button>

        <button
          onClick={actions.cancelProcessing}
          disabled={!isProcessing}
        >
          Cancel
        </button>

        <button onClick={actions.reset}>
          Reset
        </button>
      </div>

      {isProcessing && (
        <div className="progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p>
            Processing: {formatNumber(processedItems)} / {formatNumber(totalItems)}
            ({Math.round(progress * 100)}%)
          </p>
        </div>
      )}

      {result !== null && (
        <div className="result">
          <h3>Result: {formatNumber(result)}</h3>
          <p>Computation completed in Web Worker!</p>
        </div>
      )}
    </div>
  )
}
```

The component has no idea it's talking to a worker. The framework handles all the message passing, state synchronization, and error handling transparently.

## What We've Learned

Through this progression, we've seen how Steward's architecture scales:

1. **Start Simple**: Basic services with local state management
2. **Add Structure**: Message-driven communication for better debugging and testing
3. **Scale Performance**: Worker services for CPU-intensive operations
4. **Maintain Simplicity**: Components never need to change as services evolve

## Key Concepts

### Location Transparency
Whether a service runs in the main thread or a Web Worker is an implementation detail. Your components interact with services through the same API regardless.

### Progressive Enhancement
You don't need to design for workers from day one. Start simple, add messaging when you need structured communication, move to workers when you need performance.

### Reactive State
State changes automatically propagate to subscribing components. You never need to manually sync state between services and UI.

### Type Safety
Full TypeScript support means you get intelligent auto-completion, compile-time error checking, and refactoring safety throughout your application.

## Next Steps

Now that you understand the fundamentals, you can:

- **Explore the [Architecture Guide](./architecture.md)** for deeper concepts
- **Check out the [API Reference](./api.md)** for complete documentation
- **See the [Live Demo](https://steward-demo.vercel.app)** for working examples
- **Try building your own services** and see how they scale

The beauty of Steward is that you can start with familiar patterns and progressively adopt more advanced features as your application grows. There's no big architectural rewrite - just incremental improvements that compound over time.

Happy building!