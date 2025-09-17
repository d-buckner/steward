# Steward

A service-based architecture with dependency injection and event-driven state management for frontend applications.

## Features

- **Strongly typed state access** - `service.state.count` with full TypeScript IntelliSense
- **Message-driven architecture** - Pure message handlers with location transparency
- **Push-based reactivity** - State updates propagate through event system
- **Expressive APIs** - Multi-parameter actions: `actions.addItem('New item', 1)`
- **TypeScript-first** - Full type safety with namespace augmentation
- **Framework integrations** - React hooks and SolidJS primitives
- **Collaboration ready** - Built-in CRDT support with Automerge
- **Turbo monorepo** - Fast builds and testing with intelligent caching

## Quick Start

```bash
npm install @d-buckner/steward @d-buckner/steward-react
```

```tsx
import { ServiceContainer, Service } from '@d-buckner/steward'
import { ServiceProvider, useServiceState, useServiceActions } from '@d-buckner/steward-react'

// 1. Define your service
class CounterService extends Service<{ count: number }> {
  constructor() {
    super({ count: 0 })
  }

  increment() {
    // Access state directly with full type safety
    this.setState('count', this.state.count + 1)
  }

  decrement() {
    this.setState('count', this.state.count - 1)
  }
}

// 2. Register service
declare module '@d-buckner/steward' {
  namespace ServiceToken {
    interface Registry {
      counter: CounterService
    }
  }
}

// 3. Use in React
function Counter() {
  const count = useServiceState('counter', 'count')
  const actions = useServiceActions('counter')

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={actions.increment}>+</button>
      <button onClick={actions.decrement}>-</button>
    </div>
  )
}

// 4. Setup container
const container = new ServiceContainer()
container.register('counter', () => new CounterService())

function App() {
  return (
    <ServiceProvider container={container}>
      <Counter />
    </ServiceProvider>
  )
}
```

## Message-driven Services

For complex workflows, use message-driven services with custom action creators:

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
  constructor() {
    super({ items: [] })
  }

  async handle(message: Message<TodoMessages>) {
    switch (message.type) {
      case 'ADD_ITEM':
        // Handle add item
        break
      case 'TOGGLE_ITEM':
        // Handle toggle
        break
      case 'DELETE_ITEM':
        // Handle delete
        break
    }
  }
}

// Expressive usage in components
function TodoApp() {
  const actions = useServiceActions('todos')
  
  return (
    <button onClick={() => actions.addItem('New task', 1)}>
      Add High Priority Task
    </button>
  )
}
```

## Packages

- **`@d-buckner/steward`** - Core service architecture
- **`@d-buckner/steward-react`** - React hooks and providers
- **`@d-buckner/steward-solid`** - SolidJS primitives

## Documentation

- [API Reference](./docs/api.md)
- [Getting Started Guide](./docs/getting-started.md)
- [Architecture Guide](./docs/architecture.md)
- [React Integration](./packages/react/README.md)
- [SolidJS Integration](./packages/solid/README.md)

## License

MIT © [Daniel Buckner](https://github.com/d-buckner)