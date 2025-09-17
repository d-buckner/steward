# Getting Started with Steward

This guide will walk you through building your first application with Steward's service-based architecture.

## Installation

Choose your framework integration:

```bash
# For React applications
npm install @d-buckner/steward @d-buckner/steward-react

# For SolidJS applications  
npm install @d-buckner/steward @d-buckner/steward-solid

# Core only
npm install @d-buckner/steward
```

## Core Concepts

Steward is built around three main concepts:

1. **Services** - Stateful business logic containers
2. **ServiceContainer** - Dependency injection system
3. **Framework Integration** - Reactive hooks/primitives

## Your First Service

Let's build a simple counter service:

```typescript
// services/CounterService.ts
import { Service } from '@d-buckner/steward'

interface CounterState {
  count: number
  step: number
}

export class CounterService extends Service<CounterState> {
  constructor() {
    super({ count: 0, step: 1 })
  }

  increment() {
    // Use strongly typed state access with full IntelliSense
    this.setState('count', this.state.count + this.state.step)
  }

  decrement() {
    this.setState('count', this.state.count - this.state.step)
  }

  setStep(step: number) {
    this.setState('step', step)
  }

  reset() {
    this.setState('count', 0)
  }
  
  // Example of reading state with type safety
  getCurrentCount(): number {
    return this.state.count
  }
  
  canDecrement(): boolean {
    return this.state.count > 0
  }
}
```

## Service Registration

Register your service with TypeScript types:

```typescript
// types/services.ts
import type { CounterService } from '../services/CounterService'

declare module '@d-buckner/steward' {
  namespace ServiceToken {
    interface Registry {
      counter: CounterService
    }
  }
}
```

## React Integration

Set up the service container and provider:

```tsx
// App.tsx
import React from 'react'
import { ServiceContainer } from '@d-buckner/steward'
import { ServiceProvider } from '@d-buckner/steward-react'
import { CounterService } from './services/CounterService'
import { Counter } from './components/Counter'

// Create container and register services
const container = new ServiceContainer()
container.register('counter', () => new CounterService())

export function App() {
  return (
    <ServiceProvider container={container}>
      <div className="app">
        <h1>Steward Counter App</h1>
        <Counter />
      </div>
    </ServiceProvider>
  )
}
```

Create a reactive component:

```tsx
// components/Counter.tsx
import React from 'react'
import { useServiceState, useServiceActions } from '@d-buckner/steward-react'

export function Counter() {
  const count = useServiceState('counter', 'count')
  const step = useServiceState('counter', 'step')
  const actions = useServiceActions('counter')

  return (
    <div className="counter">
      <h2>Count: {count}</h2>
      
      <div className="controls">
        <button onClick={actions.increment}>
          + {step}
        </button>
        <button onClick={actions.decrement}>
          - {step}
        </button>
        <button onClick={actions.reset}>
          Reset
        </button>
      </div>

      <div className="step-control">
        <label>
          Step:
          <input
            type="number"
            value={step}
            onChange={(e) => actions.setStep(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  )
}
```

## SolidJS Integration

For SolidJS applications, use reactive primitives instead:

```tsx
// App.tsx (SolidJS)
import { ServiceContainer } from '@d-buckner/steward'
import { ServiceProvider } from '@d-buckner/steward-solid'
import { CounterService } from './services/CounterService'
import { Counter } from './components/Counter'

const container = new ServiceContainer()
container.register('counter', () => new CounterService())

export function App() {
  return (
    <ServiceProvider container={container}>
      <div class="app">
        <h1>Steward Counter App</h1>
        <Counter />
      </div>
    </ServiceProvider>
  )
}
```

```tsx
// components/Counter.tsx (SolidJS)
import { createServiceState, createServiceActions } from '@d-buckner/steward-solid'

export function Counter() {
  const count = createServiceState('counter', 'count')
  const step = createServiceState('counter', 'step')
  const actions = createServiceActions('counter')

  return (
    <div class="counter">
      <h2>Count: {count()}</h2>
      
      <div class="controls">
        <button onClick={actions.increment}>
          + {step()}
        </button>
        <button onClick={actions.decrement}>
          - {step()}
        </button>
        <button onClick={actions.reset}>
          Reset
        </button>
      </div>

      <div class="step-control">
        <label>
          Step:
          <input
            type="number"
            value={step()}
            onInput={(e) => actions.setStep(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  )
}
```

## Message-driven Services

For more complex applications, use message-driven services:

```typescript
// services/TodoService.ts
import { MessageService, withMessages, Message } from '@d-buckner/steward'

interface TodoState {
  items: Array<{ id: string; text: string; completed: boolean; priority: number }>
  filter: 'all' | 'active' | 'completed'
}

interface TodoMessages {
  ADD_ITEM: { text: string; priority: number }
  TOGGLE_ITEM: { id: string }
  DELETE_ITEM: { id: string }
  SET_FILTER: { filter: 'all' | 'active' | 'completed' }
  CLEAR_COMPLETED: {}
}

@withMessages(['ADD_ITEM', 'TOGGLE_ITEM', 'DELETE_ITEM', 'SET_FILTER', 'CLEAR_COMPLETED'], {
  ADD_ITEM: (text: string, priority: number = 0) => ({ text, priority }),
  TOGGLE_ITEM: (id: string) => ({ id }),
  DELETE_ITEM: (id: string) => ({ id }),
  SET_FILTER: (filter: 'all' | 'active' | 'completed') => ({ filter }),
  CLEAR_COMPLETED: () => ({})
})
export class TodoService extends MessageService<TodoState, TodoMessages> {
  constructor() {
    super({ items: [], filter: 'all' })
  }

  async handle(message: Message<TodoMessages>) {
    switch (message.type) {
      case 'ADD_ITEM':
        const newItem = {
          id: Date.now().toString(),
          text: message.payload.text,
          completed: false,
          priority: message.payload.priority
        }
        this.setState('items', [...this.state.items, newItem])
        break

      case 'TOGGLE_ITEM':
        this.setState('items', this.state.items.map(item =>
          item.id === message.payload.id
            ? { ...item, completed: !item.completed }
            : item
        ))
        break

      case 'DELETE_ITEM':
        this.setState('items', this.state.items.filter(item => item.id !== message.payload.id))
        break

      case 'SET_FILTER':
        this.setState('filter', message.payload.filter)
        break

      case 'CLEAR_COMPLETED':
        this.setState('items', this.state.items.filter(item => !item.completed))
        break
    }
  }
}
```

Use the expressive action API:

```tsx
function TodoApp() {
  const items = useServiceState('todos', 'items')
  const actions = useServiceActions('todos')

  return (
    <div>
      <button onClick={() => actions.addItem('High priority task', 2)}>
        Add High Priority
      </button>
      <button onClick={() => actions.addItem('Normal task')}>
        Add Normal Priority
      </button>
      <button onClick={actions.clearCompleted}>
        Clear Completed
      </button>
      
      {items?.map(item => (
        <div key={item.id}>
          <span onClick={() => actions.toggleItem(item.id)}>
            {item.text} (Priority: {item.priority})
          </span>
          <button onClick={() => actions.deleteItem(item.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}
```

## Service Dependencies

Services can depend on other services:

```typescript
// services/UserService.ts
export class UserService extends Service<UserState> {
  constructor(private auth: AuthService) {
    super({ currentUser: null })
  }

  async loadCurrentUser() {
    // Use strongly typed state access
    const token = this.auth.state.token
    if (token) {
      const user = await api.getCurrentUser(token)
      this.setState('currentUser', user)
    }
  }
}

// Registration with dependencies
container.register('auth', () => new AuthService())
container.register('users', () => new UserService(container.resolve('auth')))
```

## Next Steps

- [Architecture Guide](./architecture.md) - Understand the design principles
- [API Reference](./api.md) - Complete API documentation
- [Examples](../examples/) - Real-world examples and patterns

## Best Practices

1. **Keep services focused** - Single responsibility principle
2. **Use message-driven for complex workflows** - Better debugging and testing
3. **Leverage TypeScript** - Full type safety with service tokens
4. **Test services independently** - Mock dependencies for unit tests
5. **Use dependency injection** - Makes services testable and modular