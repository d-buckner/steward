# Architecture Guide

You've built a React app. It started simple - a component here, some useState there, maybe a useContext for the data that needs to be shared. But as your app grew, you probably ran into some familiar problems.

Your components started getting tightly coupled because they all needed to share state. Performance became an issue when you needed to do some heavy computation, but moving that work to a Web Worker meant rewriting your entire approach. And somewhere along the way, what started as clean, predictable code became increasingly complex to maintain.

Sound familiar? These aren't unique problems - they're fundamental challenges that come with building any system that needs to scale. And they've been solved before.

## Learning from the BEAM

The Erlang BEAM virtual machine has been running distributed, fault-tolerant systems for decades. WhatsApp handles billions of messages through it. Discord's real-time chat relies on it. The secret isn't some complex technology - it's a surprisingly simple idea: build your system from isolated processes that communicate purely through messages.

In the BEAM world, everything is a process. Need to handle user authentication? That's a process. Managing a chat room? Another process. Each process is completely isolated, manages its own state, and communicates with other processes only through message passing. If a process crashes, it doesn't take down your entire system.

But here's the key insight: **if your system is already message-driven, it doesn't matter where those processes actually run**. They could be on the same machine, distributed across a cluster, or running in completely different data centers. The programming model stays exactly the same.

Steward brings this battle-tested approach to frontend development.

## Message-Driven Architecture

Instead of thinking about your application as a tree of components sharing state, think about it as a collection of services that communicate through messages.

```typescript
// Instead of this tightly-coupled approach
function TodoApp() {
  const [todos, setTodos] = useState([])
  const [filter, setFilter] = useState('all')

  const addTodo = (text) => {
    const newTodo = { id: generateId(), text, completed: false }
    setTodos([...todos, newTodo])
    // Also need to update analytics, sync to server, etc.
  }

  return <TodoList todos={todos} onAdd={addTodo} />
}
```

```typescript
// Think about this service-driven approach
class TodoService extends Service<TodoState> {
  addTodo(text: string) {
    const newTodo = { id: generateId(), text, completed: false }
    this.setState('items', [...this.state.items, newTodo])

    // Other services can react to this change
    this.syncToServer(newTodo)
    this.trackEvent('todo_added')
  }

  syncToServer(todo: Todo) {
    // Sync logic here
  }

  trackEvent(eventName: string) {
    // Analytics logic here
  }
}
```

Your React components become simple views that react to service state:

```typescript
function TodoApp() {
  const state = useServiceState(TodoToken)
  const actions = useServiceActions(TodoToken)

  return <TodoList todos={state.items} onAdd={actions.addTodo} />
}
```

Each service is isolated, testable, and focused on a single responsibility. More importantly, the communication between services is explicit and traceable.

## How the Magic Works

Steward's architecture is built in layers, each solving a specific problem you encounter as your application grows.

### The Foundation: Services

At the bottom, you have the `Service` class. It's deceptively simple - just a container for state that notifies listeners when that state changes:

```typescript
class CounterService extends Service<{ count: number }> {
  constructor() {
    super({ count: 0 })
  }

  increment() {
    this.setState('count', this.state.count + 1)
  }
}
```

Your React components can subscribe to specific pieces of state and automatically re-render when they change:

```typescript
function Counter() {
  const state = useServiceState(CounterToken)
  const actions = useServiceActions(CounterToken)

  return <button onClick={actions.increment}>{state.count}</button>
}
```

This alone solves the "sharing state between components" problem. But what happens when your logic gets more complex?

### Auto-Derived Actions

Services automatically expose their methods as actions through the message system. Every method becomes a callable action from your components:

```typescript
class TodoService extends Service<TodoState> {
  // These methods automatically become actions
  addTodo(text: string) {
    const newTodo = { id: generateId(), text, completed: false }
    this.setState('items', [...this.state.items, newTodo])

    // Coordinate with other services
    this.validateTodo(newTodo)
    this.syncToServer(newTodo)
  }

  toggleTodo(id: string) {
    this.setState('items', this.state.items.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ))
  }

  private validateTodo(todo: Todo) {
    // Private methods are not exposed as actions
  }
}
```

Now your service interactions are explicit, debuggable, and testable. Every state change has a clear cause through method calls.

### Dependency Injection

As you build more services, you need a way to wire them together. The `ServiceContainer` handles this:

```typescript
// Register your services
container.register(TodoToken, () => new TodoService())
container.register(AnalyticsToken, () => new AnalyticsService())

// Services can depend on each other
class TodoService extends Service<TodoState, TodoMessages> {
  constructor(private analytics = container.resolve(AnalyticsToken)) {
    super({ items: [] })
  }

  async handle(message: Message<TodoMessages>) {
    // Use other services
    await this.analytics.track('todo_added')
  }
}
```

### Framework Integration

Finally, you need clean ways to connect services to your UI framework. The React integration provides hooks that handle subscriptions automatically:

```typescript
// Proxy-based state access with automatic subscriptions
const state = useServiceState(TodoToken) // Re-renders when any accessed property changes
const { items, filter } = state // Destructuring support

// Get type-safe action creators
const actions = useServiceActions(TodoToken) // { addTodo, toggleTodo, deleteTodo }
const { addTodo, toggleTodo } = actions // Destructuring support
```

The SolidJS integration works similarly but uses signals for even more granular reactivity.

## The Information Flow

Here's what actually happens when a user clicks a button in your app:

1. **Component** calls an action: `actions.addTodo('Buy groceries')`
2. **Action Proxy** routes this to the service method: `service.send('addTodo', ['Buy groceries'])`
3. **Service** executes the method and updates its state
4. **State Change** triggers notifications to all subscribers
5. **Components** automatically re-render with the new state

The beauty is that every step is explicit and debuggable. You can see exactly what happened, when, and why. Your React DevTools will show you the state changes, and Steward's action tracing shows you the exact sequence of method calls that caused them.

## Location Transparency

Services can be moved between execution contexts without code changes:

### Same Thread
```typescript
container.register('calculator', () => new CalculatorService())
const calc = container.resolve('calculator')
await calc.send('ADD', { a: 1, b: 2 })
```

### Web Worker
```typescript
container.register('calculator', () => new WorkerCalculatorService())
// Same API, different execution context
const calc = container.resolve('calculator')
await calc.send('ADD', { a: 1, b: 2 })
```

### Network Service
```typescript
container.register('calculator', () => new RemoteCalculatorService('https://api.example.com'))
// Same API, remote execution
const calc = container.resolve('calculator')
await calc.send('ADD', { a: 1, b: 2 })
```

## State Management Patterns

### Local State Pattern

For component-local state without cross-component sharing:

```typescript
class FormService extends Service<FormState> {
  validateField(field: string, value: string) {
    const errors = this.state.errors
    const newErrors = { ...errors }
    
    if (this.isFieldValid(field, value)) {
      delete newErrors[field]
    } else {
      newErrors[field] = 'Invalid value'
    }
    
    this.updateState({ errors: newErrors })
  }
}
```

### Global State Pattern

For application-wide state shared across components:

```typescript
class AppStateService extends Service<AppState> {
  constructor() {
    super({
      user: null,
      theme: 'light',
      notifications: []
    })
  }
  
  setTheme(theme: 'light' | 'dark') {
    this.updateState({ theme })
  }
}
```

### Collaborative State Pattern

For real-time collaborative features using CRDTs:

```typescript
class DocumentService extends CRDTService<DocumentState> {
  updateContent(content: string) {
    this.updateDoc(doc => {
      doc.content = content
      doc.lastModified = Date.now()
    })
  }
  
  // Automatic conflict resolution
  onRemoteChange(remoteDoc: DocumentState) {
    this.merge(remoteDoc)
  }
}
```

## Service Communication Patterns

### Direct Action Calls

Most common pattern for simple state updates:

```typescript
// Direct method calls become actions
await todoService.addTodo('Buy groceries')
await settingsService.updateTheme('dark')
```

### Service Coordination

Services can coordinate through method calls and event subscriptions:

```typescript
class UserService extends Service<UserState> {
  login(credentials: LoginCredentials) {
    // Update state
    this.setState('user', authenticatedUser)

    // Coordinate with other services
    this.initializeUserData()
    this.trackLogin()
  }

  private initializeUserData() {
    // Initialize user-specific data
  }

  private trackLogin() {
    // Trigger analytics
  }
}
```

### Event Broadcasting

For notifying multiple services about state changes:

```typescript
class UserService extends Service<UserState> {
  login(user: User) {
    this.setState('currentUser', user)

    // Emit events for other services to listen to
    this.emit('userLoggedIn', user.id)
  }
}

// Other services can listen for these events
class AnalyticsService extends Service<AnalyticsState> {
  constructor(userService: UserService) {
    super({ events: [] })

    // Subscribe to user service events
    userService.on('userLoggedIn', (userId) => {
      this.trackEvent('login', { userId })
    })
  }

  trackEvent(event: string, data: any) {
    this.setState('events', [...this.state.events, { event, data, timestamp: Date.now() }])
  }
}
```

## Testing Architecture

### Unit Testing Services

```typescript
describe('CounterService', () => {
  it('should increment count', () => {
    const service = new CounterService()
    service.increment()
    expect(service.state.count).toBe(1)
  })
})
```

### Integration Testing with Actions

```typescript
describe('TodoService', () => {
  it('should add item through action', async () => {
    const service = new TodoService()

    // Call the method directly or through action proxy
    await service.addTodo('Test item')

    const items = service.state.items
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('Test item')
  })
})
```

### Component Testing

```typescript
describe('Counter Component', () => {
  it('should display current count', () => {
    const container = new ServiceContainer()
    container.register('counter', () => new CounterService())
    
    render(
      <ServiceProvider container={container}>
        <Counter />
      </ServiceProvider>
    )
    
    expect(screen.getByText('Count: 0')).toBeInTheDocument()
  })
})
```

## Performance Considerations

### Event Batching

State updates are automatically batched within React/SolidJS render cycles:

```typescript
// Multiple updates in same tick are batched
service.updateState({ count: 1 })
service.updateState({ name: 'test' })
// Only one re-render occurs
```

### Selective Subscriptions

Components automatically subscribe to all accessed state properties through the proxy:

```typescript
function Counter() {
  const state = useServiceState(CounterToken)
  // Component re-renders when any accessed property changes
  return <div>Count: {state.count}</div> // Only subscribes to 'count'
}

function CounterWithName() {
  const { count, name } = useServiceState(CounterToken)
  // Component re-renders when either 'count' or 'name' changes
  return <div>{name}: {count}</div>
}
```

### Action Tracing

Services automatically maintain action history for debugging:

```typescript
class TodoService extends Service<TodoState> {
  constructor() {
    super({ items: [] })
    // Action calls are automatically traced in development
  }

  addTodo(text: string) {
    // All method calls are logged for debugging
    const newTodo = { id: generateId(), text, completed: false }
    this.setState('items', [...this.state.items, newTodo])
  }
}
```

## Future Architecture

### Planned Enhancements

1. **Service Mesh** - Automatic service discovery and load balancing
2. **Persistence Layer** - Automatic state persistence with configurable adapters
3. **DevTools** - Visual service graph and message flow debugging
4. **Worker Orchestration** - Automatic service distribution to web workers
5. **Network Providers** - Built-in WebSocket and SSE support for distributed services

### Migration Path

The architecture is designed for gradual adoption:

1. Start with traditional services for simple state
2. Adopt message-driven services for complex workflows
3. Add collaboration features with CRDT services
4. Scale to distributed services when needed

Each step maintains backward compatibility while unlocking new capabilities.