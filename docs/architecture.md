# Architecture Guide

This guide explains the design principles and architectural decisions behind Steward.

## Overview

Steward is a service-based architecture inspired by message-driven systems like Elixir's Waterpark platform. It provides location transparency, making services easily distributable across network boundaries and worker threads.

## Core Principles

### 1. Message-driven Communication

Services communicate exclusively through messages, not direct method calls. This enables:

- **Location transparency** - Services can run anywhere (main thread, worker, remote)
- **Debugging** - All interactions are traceable message events
- **Testing** - Easy to mock and replay message sequences
- **Distribution** - Services can be moved to different execution contexts

```typescript
// Instead of direct calls
userService.updateProfile(name, email)

// Use messages
await userService.send('UPDATE_PROFILE', { name, email })
```

### 2. Push-based Reactivity

State changes flow through the system via events, not polling or manual subscriptions:

```typescript
// State updates automatically notify all subscribers
service.updateState({ count: newCount })

// React components re-render automatically
const count = useServiceState('counter', 'count')
```

### 3. Expressive APIs

Despite message-driven internals, APIs remain expressive through action creators:

```typescript
// Expressive function calls
actions.addItem('Buy groceries', 2) // text, priority

// Maps to messages internally
{ type: 'ADD_ITEM', payload: { text: 'Buy groceries', priority: 2 } }
```

## Architecture Layers

### Layer 1: Core Services

**Service** - Base reactive state container
- Manages local state with automatic change notifications
- Provides event-driven subscriptions
- Framework-agnostic foundation

**MessageService** - Message-driven service extension
- Handles async message processing
- Supports request/response patterns
- Maintains message history for debugging

```typescript
class Service<State extends Record<string, any>> implements EventBus {
  private eventBus: ServiceEventBus<State>
  private state: State
  
  updateState(updates: Partial<State>): void
  get<K extends keyof State>(key: K): State[K]
  on<T = any>(event: string, handler: EventHandler<T>): EventSubscription
}

class MessageService<State, Messages extends MessageDefinition> extends Service<State> {
  abstract handle<K extends keyof Messages>(message: Message<Messages, K>): Promise<void> | void
  send<K extends keyof Messages>(type: K, payload: Messages[K], correlationId?: string): Promise<void>
  request<ReqKey, ResKey>(requestType: ReqKey, payload: Messages[ReqKey], responseType: ResKey, timeout?: number): Promise<Messages[ResKey]>
}
```

### Layer 2: Dependency Injection

**ServiceContainer** - IoC container with type-safe resolution
- Singleton service instances
- Lazy initialization
- Dependency graph management

```typescript
class ServiceContainer {
  register<K extends keyof ServiceToken.Registry>(
    token: K, 
    factory: () => ServiceToken.Registry[K]
  ): void
  
  resolve<K extends keyof ServiceToken.Registry>(
    token: K
  ): ServiceToken.Registry[K]
}
```

### Layer 3: Framework Integration

**React Integration** (`@steward/react`)
- `useServiceState` - Reactive state subscriptions with automatic re-rendering
- `useServiceActions` - Type-safe action dispatching with message/method detection
- `useServiceContainer` - Direct container access
- `ServiceProvider` - Container context provider

**SolidJS Integration** (`@steward/solid`)
- `createServiceState` - Signal-based reactive state with fine-grained updates
- `createServiceActions` - Action creator binding with solid reactivity
- `ServiceProvider` - Context integration for dependency injection

## Message Flow Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Component     │───▶│   Action API     │───▶│  Message Bus    │
│  (React/Solid)  │    │  (useActions)    │    │  (EventBus)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                                               │
         │                                               ▼
         │               ┌──────────────────┐    ┌─────────────────┐
         └───────────────│   State Events   │◀───│   Service       │
                         │  (useServiceState) │    │  (Handler)      │
                         └──────────────────┘    └─────────────────┘
```

1. **Component** triggers action via expressive API
2. **Action API** converts to message with proper payload
3. **Message Bus** routes message to appropriate service
4. **Service** processes message and updates state
5. **State Events** notify all subscribers of changes
6. **Component** re-renders with new state

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

## Message Patterns

### Fire-and-Forget

Most common pattern for state updates:

```typescript
await service.send('UPDATE_SETTINGS', { theme: 'dark' })
// No response expected
```

### Request-Response

For queries or operations requiring confirmation:

```typescript
const result = await service.request(
  'CALCULATE_TOTAL',
  { items },
  'TOTAL_CALCULATED',
  5000 // timeout
)
```

### Event Broadcasting

For notifying multiple services:

```typescript
// Service A
await eventBus.broadcast('USER_LOGGED_IN', { userId: '123' })

// Services B, C, D all receive the event
class AnalyticsService extends MessageService<{}, UserEvents> {
  handle(message: Message<UserEvents>) {
    if (message.type === 'USER_LOGGED_IN') {
      this.trackEvent('login', message.payload)
    }
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

### Integration Testing with Messages

```typescript
describe('TodoService', () => {
  it('should handle ADD_ITEM message', async () => {
    const service = new TodoService()
    
    await service.handle({
      type: 'ADD_ITEM',
      payload: { text: 'Test', priority: 1 },
      id: '1',
      timestamp: Date.now()
    })
    
    const items = service.state.items
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('Test')
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

Components only subscribe to specific state keys:

```typescript
// Only re-renders when 'count' changes, not 'name'
const count = useServiceState('counter', 'count')
```

### Message History

Message services automatically maintain history for debugging:

```typescript
class TodoService extends MessageService<State, Messages> {
  constructor() {
    super({ items: [] })
    // Message history is automatically maintained
  }
  
  // Access message history for debugging
  getMessageHistory() {
    return this.messageHistory // Available in development
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