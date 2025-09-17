# @steward/react

React hooks and providers for [Steward](https://github.com/d-buckner/steward) service architecture.

## Installation

```bash
npm install @d-buckner/steward @d-buckner/steward-react
```

## Quick Start

```tsx
import React from 'react'
import { ServiceContainer } from '@d-buckner/steward'
import { ServiceProvider, useServiceState, useServiceActions } from '@d-buckner/steward-react'

// 1. Create your service
class CounterService extends Service<{ count: number }> {
  constructor() {
    super({ count: 0 })
  }

  increment() {
    // Use strongly typed state access with full IntelliSense
    this.setState('count', this.state.count + 1)
  }
}

// 2. Register service types
declare module '@d-buckner/steward' {
  namespace ServiceToken {
    interface Registry {
      counter: CounterService
    }
  }
}

// 3. Setup container
const container = new ServiceContainer()
container.register('counter', () => new CounterService())

// 4. Use in components
function Counter() {
  const count = useServiceState('counter', 'count')
  const actions = useServiceActions('counter')

  return (
    <div>
      <p>Count: {count}</p>
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

Subscribe to reactive state changes from any service.

```tsx
const value = useServiceState(serviceToken, stateKey)
```

**Parameters:**
- `serviceToken` - The service identifier
- `stateKey` - The state property to subscribe to

**Returns:** Current value of the state property

**Example:**
```tsx
const count = useServiceState('counter', 'count')
const username = useServiceState('auth', 'username')
```

### useServiceActions

Get type-safe action dispatchers for a service. Automatically detects if the service uses messages or direct methods.

```tsx
const actions = useServiceActions(serviceToken)
```

**Parameters:**
- `serviceToken` - The service identifier

**Returns:** Object with action methods

**Examples:**

For traditional services:
```tsx
const actions = useServiceActions('counter')
// actions.increment() - calls method directly
```

For message-driven services:
```tsx
const actions = useServiceActions('todos')
// actions.addItem('Buy milk', 1) - converts to message
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

## Message-driven Services

For services using message-driven architecture:

```tsx
import { MessageService, withMessages } from '@d-buckner/steward'

interface TodoMessages {
  ADD_ITEM: { text: string; priority: number }
  TOGGLE_ITEM: { id: string }
  DELETE_ITEM: { id: string }
}

@withMessages(['ADD_ITEM', 'TOGGLE_ITEM', 'DELETE_ITEM'], {
  ADD_ITEM: (text: string, priority: number = 0) => ({ text, priority }),
  TOGGLE_ITEM: (id: string) => ({ id }),
  DELETE_ITEM: (id: string) => ({ id })
})
class TodoService extends MessageService<TodoState, TodoMessages> {
  // Implementation
}

// Usage in components
function TodoApp() {
  const items = useServiceState('todos', 'items')
  const actions = useServiceActions('todos')

  return (
    <div>
      <button onClick={() => actions.addItem('New task', 2)}>
        Add High Priority Task
      </button>
      
      {items?.map(item => (
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
// State types are inferred
const count: number = useServiceState('counter', 'count')

// Action types are inferred from service methods
const actions: {
  increment: () => Promise<void>
  decrement: () => Promise<void>
  reset: () => Promise<void>
} = useServiceActions('counter')
```

## Best Practices

1. **Minimize subscriptions** - Only subscribe to state you actually need
2. **Use action creators** - Prefer expressive APIs over raw message sending  
3. **Type your services** - Register service types for full TypeScript support
4. **Compose services** - Break complex state into focused service domains
5. **Test components** - Use ServiceProvider in tests with mock containers

## Examples

See the [main Steward repository](https://github.com/d-buckner/steward) for complete examples and documentation.

## License

MIT © [Daniel Buckner](https://github.com/d-buckner)