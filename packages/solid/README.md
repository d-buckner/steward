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
  const state = createServiceState('counter')
  const actions = createServiceActions('counter')

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

## Primitives

### createServiceState

Create a reactive proxy from service state that automatically provides fine-grained signals for all properties.

```tsx
const state = createServiceState(serviceToken)
```

**Parameters:**
- `serviceToken` - The service identifier

**Returns:** Proxy object providing reactive access to all state properties

**Examples:**
```tsx
const state = createServiceState('counter')
// Access any property: state.count, state.isActive, etc.

// Destructuring support
const { count, isActive } = createServiceState('counter')

// Use in JSX - each property access creates fine-grained reactivity
return <p>Count: {state.count}</p> // Only updates when count changes

// Use in effects
createEffect(() => {
  console.log('Count changed to:', state.count)
})
```

### createServiceActions

Get type-safe action dispatchers for a service. Service methods are automatically exposed as callable actions.

```tsx
const actions = createServiceActions(serviceToken)
```

**Parameters:**
- `serviceToken` - The service identifier

**Returns:** Proxy object with action methods

**Examples:**

```tsx
const actions = createServiceActions('counter')
// All public methods become actions: actions.increment(), actions.decrement(), etc.

// Destructuring support
const { increment, decrement, reset } = createServiceActions('counter')

// All actions are async and message-driven
await actions.increment()
await increment() // Same effect
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
  const state = createServiceState('todos')

  // Only updates when items array changes
  return (
    <For each={state.items}>
      {(item) => <TodoItem item={item} />}
    </For>
  )
}
```

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
  const state = createServiceState('todos')
  const actions = createServiceActions('todos')

  return (
    <div>
      <button onClick={() => actions.addItem('New task', 2)}>
        Add High Priority Task
      </button>

      <For each={state.items}>
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
  const state = createServiceState('cart')

  const total = createMemo(() => {
    const subtotal = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    return subtotal * (1 - state.discountRate)
  })

  return <p>Total: ${total().toFixed(2)}</p>
}
```

### Conditional Subscriptions

Fine-grained reactivity only subscribes to accessed properties:

```tsx
function UserProfile() {
  const [showDetails, setShowDetails] = createSignal(false)
  const state = createServiceState('user')

  return (
    <div>
      <button onClick={() => setShowDetails(!showDetails())}>
        Toggle Details
      </button>

      <Show when={showDetails()}>
        <div>{state.details?.bio}</div> {/* Only subscribes when accessed */}
      </Show>
    </div>
  )
}
```

## TypeScript

Full TypeScript support with automatic type inference:

```typescript
// State proxy provides full type safety
const state = createServiceState(CounterToken) // Typed as CounterState proxy
const count: number = state.count // Property access is fully typed

// Destructuring maintains types
const { count, isActive }: { count: number; isActive: boolean } = createServiceState(CounterToken)

// Action types are inferred from service methods
const actions: {
  increment: () => Promise<void>
  decrement: () => Promise<void>
  reset: () => Promise<void>
} = createServiceActions(CounterToken)
```

## Best Practices

1. **Leverage fine-grained reactivity** - Each property access creates precise subscriptions
2. **Use proxy-based state access** - Access only the properties you need for optimal performance
3. **Leverage destructuring** - Extract specific properties for cleaner component code
4. **Use derived state** - Combine service state with `createMemo` for computed values
5. **Use service tokens** - Create typed tokens for full TypeScript support
6. **Use Show/For components** - Take advantage of SolidJS control flow

## Examples

See the [main Steward repository](https://github.com/d-buckner/steward) for complete examples and documentation.

## License

MIT © [Daniel Buckner](https://github.com/d-buckner)