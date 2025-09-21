# @steward/react

React hooks and providers for [Steward](https://github.com/d-buckner/steward) service architecture.

## Installation

```bash
npm install @d-buckner/steward @steward/react
```

## Quick Start

```tsx
import React from 'react'
import { Service, ServiceContainer, createServiceToken } from '@d-buckner/steward'
import { ServiceProvider, useServiceState, useServiceActions } from '@steward/react'

// 1. Create your service
interface CounterState {
  count: number
}

class CounterService extends Service<CounterState> {
  constructor() {
    super({ count: 0 })
  }

  increment() {
    // Use strongly typed state access with full IntelliSense
    this.setState('count', this.state.count + 1)
  }
}

// 2. Create service token
export const CounterToken = createServiceToken<CounterService>('counter')

// 3. Setup container
const container = new ServiceContainer()
container.register(CounterToken, CounterService)

// 4. Use in components
function Counter() {
  const state = useServiceState(CounterToken)
  const actions = useServiceActions(CounterToken)

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={actions.increment}>+</button>
    </div>
  )
}

// 5. Provide container
function App() {
  return (
    <ServiceProvider container={container}>
      <Counter />
    </ServiceProvider>
  )
}
```

## Hooks

### useServiceState

Subscribe to reactive state changes from any service using a proxy that automatically provides access to all state properties.

```tsx
const state = useServiceState(serviceToken)
```

**Parameters:**
- `serviceToken` - The service identifier

**Returns:** Proxy object providing reactive access to all state properties

**Examples:**
```tsx
const state = useServiceState('counter')
// Access any property: state.count, state.isActive, etc.

// Destructuring support
const { count, isActive } = useServiceState('counter')

// Property access triggers automatic subscriptions
return <div>Count: {state.count}</div> // Only re-renders when count changes
```

### useServiceActions

Get type-safe action dispatchers for a service. Service methods are automatically exposed as callable actions.

```tsx
const actions = useServiceActions(serviceToken)
```

**Parameters:**
- `serviceToken` - The service identifier

**Returns:** Proxy object with action methods

**Examples:**

```tsx
const actions = useServiceActions('counter')
// All public methods become actions: actions.increment(), actions.decrement(), etc.

// Destructuring support
const { increment, decrement, reset } = useServiceActions('counter')

// All actions are async and message-driven
await actions.increment()
await increment() // Same effect
```

### useServiceContainer

Access the service container directly for advanced use cases.

```tsx
const container = useServiceContainer()
```

**Returns:** ServiceContainer instance

**Example:**
```tsx
const container = useServiceContainer()
const service = container.resolve('myService')
```

## Components

### ServiceProvider

Provides the service container to child components via React context.

```tsx
<ServiceProvider container={container}>
  {children}
</ServiceProvider>
```

**Props:**
- `container` - ServiceContainer instance
- `children` - React children

## Service Examples

All service methods automatically become callable actions:

```tsx
import { Service } from '@d-buckner/steward'

interface TodoState {
  items: TodoItem[]
  filter: 'all' | 'active' | 'completed'
}

class TodoService extends Service<TodoState> {
  constructor() {
    super({ items: [], filter: 'all' })
  }

  addItem(text: string, priority: number = 0) {
    const newItem = { id: generateId(), text, priority, completed: false }
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
}

// Usage in components
function TodoApp() {
  const state = useServiceState('todos')
  const actions = useServiceActions('todos')

  return (
    <div>
      <button onClick={() => actions.addItem('New task', 2)}>
        Add High Priority Task
      </button>

      {state.items?.map(item => (
        <div key={item.id}>
          <span onClick={() => actions.toggleItem(item.id)}>
            {item.text}
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

## TypeScript

Full TypeScript support with automatic type inference:

```typescript
// State proxy provides full type safety
const state = useServiceState(CounterToken) // Typed as CounterState
const count: number = state.count // Property access is fully typed

// Destructuring maintains types
const { count, isActive }: { count: number; isActive: boolean } = useServiceState(CounterToken)

// Action types are inferred from service methods
const actions: {
  increment: () => Promise<void>
  decrement: () => Promise<void>
  reset: () => Promise<void>
} = useServiceActions(CounterToken)
```

## Best Practices

1. **Use proxy-based state access** - Access only the properties you need; subscriptions are automatic
2. **Leverage destructuring** - Extract specific properties for cleaner component code
3. **Use service tokens** - Create typed tokens for full TypeScript support
4. **Compose services** - Break complex state into focused service domains
5. **Test components** - Use ServiceProvider in tests with mock containers

## Examples

See the [main Steward repository](https://github.com/d-buckner/steward) for complete examples and documentation.

## License

MIT © [Daniel Buckner](https://github.com/d-buckner)