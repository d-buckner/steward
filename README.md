# Steward

When you're building a React application, things start simple enough. A few components, some local state, maybe a context or two. But as your app grows, you start running into familiar patterns: components that need to share state become tightly coupled, performance bottlenecks require moving work to Web Workers (which means rewriting your logic), and what started as clean, predictable code becomes increasingly complex to maintain.

What if we could learn from systems that have already solved these problems?

The Erlang BEAM virtual machine has been running fault-tolerant, distributed systems for decades. Its actor model - where isolated processes communicate purely through messages - has proven itself in everything from WhatsApp's messaging infrastructure to Discord's real-time chat. But these patterns have remained largely confined to backend systems.

Steward brings these battle-tested concepts to frontend development, creating a reactive service architecture where your application is built from isolated, message-driven services that can transparently scale from local execution to Web Workers to distributed systems.

## The Problem We're Solving

Consider a typical React application as it grows:

```tsx
// This starts simple...
function TodoApp() {
  const [todos, setTodos] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  // But quickly becomes this...
  const [notifications, setNotifications] = useState([])
  const [users, setUsers] = useState([])
  const [permissions, setPermissions] = useState({})
  const [theme, setTheme] = useState('light')
  const [analytics, setAnalytics] = useState({})
  // ... and keeps growing
}
```

Now imagine you need that todo processing to be really fast - maybe you're dealing with millions of items. You'd need to move the work to a Web Worker, which means:

1. Rewriting your logic to work with postMessage
2. Serializing/deserializing data across the worker boundary
3. Managing state synchronization between main thread and worker
4. Handling errors and cleanup across process boundaries

What started as a simple state update becomes a distributed systems problem.

## The Steward Approach

Instead of fighting against these constraints, we embrace them. Every piece of functionality becomes a service - a lightweight, isolated process that manages its own state and communicates purely through messages.

```typescript
// A service is just a class that handles messages and manages state
class TodoService extends Service<TodoState, TodoMessages> {
  constructor() {
    super({ items: [], filter: 'all', loading: false })
  }

  async handle(message: Message<TodoMessages>) {
    switch (message.type) {
      case 'ADD_ITEM': {
        const { text } = message.payload
        const newItem = { id: generateId(), text, completed: false }
        this.setState('items', [...this.state.items, newItem])
        break
      }
      // Handle other messages...
    }
  }
}
```

Your React components interact with services through a clean, reactive API:

```tsx
function TodoApp() {
  const items = useServiceState(TodoToken, 'items')
  const actions = useServiceActions(TodoToken)

  return (
    <div>
      <button onClick={() => actions.addItem('Learn Steward')}>
        Add Todo
      </button>
      {items.map(item => <TodoItem key={item.id} item={item} />)}
    </div>
  )
}
```

But here's where it gets interesting. When you need that todo processing to be faster, you don't rewrite anything:

```typescript
// Just add a decorator
@withWorker({ name: 'TodoProcessor' })
class TodoService extends Service<TodoState, TodoMessages> {
  // Exact same code - now runs in a Web Worker
}
```

Your React components don't change. Your service logic doesn't change. The framework handles all the message passing, state synchronization, and error handling transparently.

## Location Transparency

This is the core insight from distributed systems that Steward brings to frontend development: **if your architecture is already message-driven, location becomes irrelevant**.

```typescript
// These three services have identical APIs from your component's perspective:

// Runs in main thread
class SearchService extends Service { /* ... */ }

// Runs in Web Worker (CPU-intensive operations)
@withWorker()
class SearchService extends Service { /* ... */ }

// Runs as remote service (future)
@withRemoteService({ endpoint: 'https://api.example.com' })
class SearchService extends Service { /* ... */ }
```

Whether a service runs locally, in a worker, or on a remote server becomes an implementation detail, not an architectural constraint.

## Progressive Enhancement

You don't need to design for distribution from day one. Steward lets you start simple and add complexity only when you need it:

**Phase 1: Local Services**
```typescript
class UserService extends Service<UserState> {
  updateProfile(data: ProfileData) {
    this.setState('profile', { ...this.state.profile, ...data })
  }
}
```

**Phase 2: Add Messaging**
```typescript
interface UserMessages extends ServiceMessages {
  UPDATE_PROFILE: { data: ProfileData }
  PROFILE_UPDATED: { profile: Profile }
}

@withMessages<UserMessages>(['UPDATE_PROFILE', 'PROFILE_UPDATED'])
class UserService extends Service<UserState, UserMessages> {
  async handle(message: Message<UserMessages>) {
    switch (message.type) {
      case 'UPDATE_PROFILE':
        // Now you have structured communication, debugging, message history
        break
    }
  }
}
```

**Phase 3: Scale to Workers**
```typescript
@withWorker({ name: 'UserProcessor' })
@withMessages<UserMessages>(['UPDATE_PROFILE', 'PROFILE_UPDATED'])
class UserService extends Service<UserState, UserMessages> {
  // Same code, now runs in worker for performance
}
```

**Phase 4: Add Collaboration (Future)**
```typescript
@withCRDT({ type: 'document' })
@withWorker({ name: 'UserProcessor' })
@withMessages<UserMessages>(['UPDATE_PROFILE', 'PROFILE_UPDATED'])
class UserService extends Service<UserState, UserMessages> {
  // Same code, now supports real-time collaboration
}
```

## Quick Start

```bash
npm install @d-buckner/steward @steward/react
```

```typescript
// 1. Define your service
import { Service, createServiceToken, ServiceState } from '@d-buckner/steward'

interface CounterState extends ServiceState {
  count: number
}

class CounterService extends Service<CounterState> {
  constructor() {
    super({ count: 0 })
  }

  handle() {} // Required abstract method

  increment() {
    this.setState('count', this.state.count + 1)
  }
}

export const CounterToken = createServiceToken<CounterService>('counter')
```

```tsx
// 2. Use in React
import { useServiceState, useServiceActions } from '@steward/react'

function Counter() {
  const count = useServiceState(CounterToken, 'count')
  const actions = useServiceActions(CounterToken)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={actions.increment}>+</button>
    </div>
  )
}
```

```typescript
// 3. Scale when needed
@withWorker({ name: 'CounterProcessor' })
class CounterService extends Service<CounterState> {
  // Same code, now runs in worker if needed
}
```

## Live Examples

See the architecture in action: **[Demo](https://steward-demo.vercel.app)**

- **Counter**: Basic reactive service patterns
- **Todos**: Message-driven state management
- **Chat**: Real-time service communication
- **Data Processing**: Worker services handling millions of items
- **Collaboration**: CRDT-based multi-user editing

## Inspiration

Steward draws from proven patterns in distributed systems:

- **Erlang/Elixir**: Actor model, fault tolerance, "let it crash" philosophy
- **Akka**: Hierarchical supervision, location transparency
- **Redux**: Predictable state through message passing
- **Web Workers**: Parallel processing without main thread blocking

But it's designed specifically for the constraints and opportunities of frontend development - reactive UIs, hot reloading, browser performance characteristics, and the need to start simple and scale progressively.

## Architecture Benefits

**Fault Isolation**: Service crashes don't cascade through your application

**Performance**: Move CPU-intensive work to workers without architectural changes

**Debugging**: Message history, time-travel debugging, and service inspection

**Testing**: Services are isolated and easily testable

**Hot Reloading**: Update services without losing application state

**Type Safety**: Full TypeScript support with intelligent auto-completion

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@d-buckner/steward` | Core service architecture | ✅ Production |
| `@steward/react` | React hooks and providers | ✅ Production |
| `@steward/solid` | SolidJS primitives | ✅ Production |
| `@steward/collaboration` | CRDT-based collaboration | 🚧 Alpha |

## Documentation

- [**Getting Started**](./docs/getting-started.md) - Build your first Steward application
- [**Architecture Guide**](./docs/architecture.md) - Core concepts and patterns
- [**API Reference**](./docs/api.md) - Complete API documentation
- [**React Integration**](./packages/react/README.md) - React-specific features
- [**SolidJS Integration**](./packages/solid/README.md) - SolidJS-specific features

## What's Next

We're focused on production readiness - better error handling, performance monitoring, and developer tools. The core architecture is stable and being used in real applications.

Future directions include service supervision patterns, hot code reloading, and transparent remote service communication. But the foundation is solid: a message-driven service architecture that scales from prototype to production.

## Contributing

Interested in contributing? We'd love your help with:

- Testing edge cases and performance scenarios
- Documentation improvements
- New framework integrations
- Real-world usage feedback

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT © [Daniel Buckner](https://github.com/d-buckner)

---

*Building reactive, scalable frontend applications through proven distributed system principles.*
