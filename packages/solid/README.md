# @steward/solid

SolidJS primitives for [Steward](https://github.com/d-buckner/steward) service architecture.

## Installation

```bash
npm install @d-buckner/steward @d-buckner/steward-solid
```

## Quick Start

```tsx
import { ServiceContainer } from '@d-buckner/steward'
import { ServiceProvider, createServiceState, createServiceActions } from '@d-buckner/steward-solid'

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
  const count = createServiceState('counter', 'count')
  const actions = createServiceActions('counter')

  return (
    <div>
      <p>Count: {count()}</p>
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

## Primitives

### createServiceState

Create a reactive signal from service state that automatically updates when the service state changes.

```tsx
const signal = createServiceState(serviceToken, stateKey)
```

**Parameters:**
- `serviceToken` - The service identifier
- `stateKey` - The state property to subscribe to

**Returns:** Solid signal accessor function

**Example:**
```tsx
const count = createServiceState('counter', 'count')
const username = createServiceState('auth', 'username')

// Use in JSX
return <p>Current count: {count()}</p>

// Use in effects
createEffect(() => {
  console.log('Count changed to:', count())
})
```

### createServiceActions

Get type-safe action dispatchers for a service. Automatically detects if the service uses messages or direct methods.

```tsx
const actions = createServiceActions(serviceToken)
```

**Parameters:**
- `serviceToken` - The service identifier

**Returns:** Object with action methods

**Examples:**

For traditional services:
```tsx
const actions = createServiceActions('counter')
// actions.increment() - calls method directly
```

For message-driven services:
```tsx
const actions = createServiceActions('todos')
// actions.addItem('Buy milk', 1) - converts to message
```

## Components

### ServiceProvider

Provides the service container to child components via SolidJS context.

```tsx
<ServiceProvider container={container}>
  {children}
</ServiceProvider>
```

**Props:**
- `container` - ServiceContainer instance
- `children` - JSX children

## Fine-grained Reactivity

SolidJS's fine-grained reactivity means only the specific parts of your UI that depend on changed state will update:

```tsx
function TodoList() {
  const items = createServiceState('todos', 'items')
  const filter = createServiceState('todos', 'filter')
  
  // Only items that change will re-render
  return (
    <For each={items()}>
      {(item) => <TodoItem item={item} />}
    </For>
  )
}
```

## Message-driven Services

For services using message-driven architecture with expressive APIs:

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
  const items = createServiceState('todos', 'items')
  const actions = createServiceActions('todos')

  return (
    <div>
      <button onClick={() => actions.addItem('New task', 2)}>
        Add High Priority Task
      </button>
      
      <For each={items()}>
        {(item) => (
          <div>
            <span onClick={() => actions.toggleItem(item.id)}>
              {item.text}
            </span>
            <button onClick={() => actions.deleteItem(item.id)}>
              Delete
            </button>
          </div>
        )}
      </For>
    </div>
  )
}
```

## Advanced Patterns

### Derived State

Combine service state with SolidJS computations:

```tsx
function ShoppingCart() {
  const items = createServiceState('cart', 'items')
  const discountRate = createServiceState('cart', 'discountRate')
  
  const total = createMemo(() => {
    const subtotal = items().reduce((sum, item) => sum + item.price * item.quantity, 0)
    return subtotal * (1 - discountRate())
  })
  
  return <p>Total: ${total().toFixed(2)}</p>
}
```

### Conditional Subscriptions

Only subscribe when needed:

```tsx
function UserProfile() {
  const [showDetails, setShowDetails] = createSignal(false)
  
  // Only subscribe to user details when showing them
  const userDetails = createServiceState('user', 'details')
  
  return (
    <div>
      <button onClick={() => setShowDetails(!showDetails())}>
        Toggle Details
      </button>
      
      <Show when={showDetails()}>
        <div>{userDetails()?.bio}</div>
      </Show>
    </div>
  )
}
```

## TypeScript

Full TypeScript support with automatic type inference:

```typescript
// State types are inferred from service
const count: Accessor<number> = createServiceState('counter', 'count')

// Action types are inferred from service methods  
const actions: {
  increment: () => Promise<void>
  decrement: () => Promise<void>
  reset: () => Promise<void>
} = createServiceActions('counter')
```

## Best Practices

1. **Leverage fine-grained reactivity** - SolidJS only updates what actually changed
2. **Use derived state** - Combine service state with `createMemo` for computed values
3. **Minimize signal calls** - Access signals sparingly in render functions
4. **Type your services** - Register service types for full TypeScript support
5. **Use Show/For components** - Take advantage of SolidJS control flow

## Examples

See the [main Steward repository](https://github.com/d-buckner/steward) for complete examples and documentation.

## License

MIT © [Daniel Buckner](https://github.com/d-buckner)