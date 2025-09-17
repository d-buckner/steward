# API Reference

## Core Classes

### Service

Base class for all services with reactive state management.

```typescript
class Service<State extends Record<string, any>>
```

#### Constructor

```typescript
constructor(initialState: State)
```

#### Properties

- `state: State` - Strongly typed proxy for reactive state access with full TypeScript IntelliSense

#### Methods

- `updateState(updates: Partial<State>): void` - Update multiple state properties
- `setState<K extends keyof State>(key: K, value: State[K]): void` - Update single state property
- `on<K extends keyof State>(key: K, callback: (value: State[K]) => void): Subscription` - Subscribe to state changes

#### Example

```typescript
class UserService extends Service<{ name: string; email: string }> {
  constructor() {
    super({ name: '', email: '' })
  }

  updateProfile(name: string, email: string) {
    // Use the strongly typed state proxy for access
    const currentName = this.state.name  // Full TypeScript IntelliSense
    
    // Update multiple properties
    this.updateState({ name, email })
    
    // Or update single property
    this.setState('name', name)
  }
  
  getName(): string {
    // Direct state access with type safety
    return this.state.name
  }
}
```

### MessageService

Extended service class for message-driven architecture.

```typescript
class MessageService<State, Messages extends MessageDefinition> extends Service<State>
```

#### Methods

- `abstract handle<K extends keyof Messages>(message: Message<Messages, K>): Promise<void> | void` - Handle incoming messages
- `send<K extends keyof Messages>(type: K, payload: Messages[K]): Promise<void>` - Send message
- `request<ReqKey, ResKey>(requestType: ReqKey, payload: Messages[ReqKey], responseType: ResKey, timeout?: number): Promise<Messages[ResKey]>` - Request/response pattern

#### Example

```typescript
interface AuthMessages {
  LOGIN: { username: string; password: string }
  LOGOUT: {}
  LOGIN_SUCCESS: { user: User }
  LOGIN_FAILED: { error: string }
}

class AuthService extends MessageService<AuthState, AuthMessages> {
  async handle(message: Message<AuthMessages>) {
    switch (message.type) {
      case 'LOGIN':
        // Handle login
        break
      case 'LOGOUT':
        // Handle logout
        break
    }
  }
}
```

### ServiceContainer

Dependency injection container for managing service instances.

```typescript
class ServiceContainer
```

#### Methods

- `register<K extends keyof ServiceToken.Registry>(token: K, factory: () => ServiceToken.Registry[K]): void` - Register service factory
- `resolve<K extends keyof ServiceToken.Registry>(token: K): ServiceToken.Registry[K]` - Resolve service instance
- `registerInstance<K extends keyof ServiceToken.Registry>(token: K, instance: ServiceToken.Registry[K]): void` - Register service instance

#### Example

```typescript
const container = new ServiceContainer()

container.register('auth', () => new AuthService())
container.register('users', () => new UserService(container.resolve('auth')))

const authService = container.resolve('auth')
```

## Decorators and Utilities

### @withMessages

Decorator for configuring message types and action creators.

```typescript
function withMessages<Messages extends MessageDefinition>(
  messageTypes: (keyof Messages)[],
  actionCreators?: ActionCreators<Messages>
)
```

#### Example

```typescript
@withMessages(['ADD_TODO', 'TOGGLE_TODO'], {
  ADD_TODO: (text: string, priority: number = 0) => ({ text, priority }),
  TOGGLE_TODO: (id: string) => ({ id })
})
class TodoService extends MessageService<TodoState, TodoMessages> {
  // Implementation
}
```

### ServiceToken Namespace

TypeScript namespace for type-safe service registration.

```typescript
declare module '@d-buckner/steward' {
  namespace ServiceToken {
    interface Registry {
      myService: MyService
    }
  }
}
```

## Type Definitions

### Message

```typescript
interface Message<T extends MessageDefinition, K extends keyof T = keyof T> {
  type: K
  payload: T[K]
  id: string
  timestamp: number
  correlationId?: string
}
```

### MessageDefinition

```typescript
type MessageDefinition = Record<string, any>
```

### ServiceActions

```typescript
type ServiceActions<T extends MessageDefinition> = {
  [K in keyof T as ToCamelCase<string & K>]: (...args: any[]) => Promise<void>
}
```

### Subscription

```typescript
interface Subscription {
  unsubscribe(): void
}
```

## CRDT Services

### CRDTService

Service with Conflict-free Replicated Data Type support using Automerge.

```typescript
class CRDTService<State> extends Service<State>
```

#### Properties

- `state: State` - Strongly typed proxy that reads directly from the Automerge document

#### Methods

- `change(changeFn: (doc: State) => void): void` - Make changes to the CRDT document
- `merge(otherDoc: State): void` - Merge external document
- `save(): Uint8Array` - Save document to binary format
- `load(data: Uint8Array): void` - Load document from binary format

#### Example

```typescript
interface DocumentState {
  title: string
  content: string
  collaborators: string[]
}

class DocumentService extends CRDTService<DocumentState> {
  constructor() {
    super({ title: '', content: '', collaborators: [] })
  }

  updateTitle(title: string) {
    this.change(doc => {
      doc.title = title
    })
  }

  addCollaborator(name: string) {
    this.change(doc => {
      doc.collaborators.push(name)
    })
  }
  
  getTitle(): string {
    // Direct state access with full type safety
    return this.state.title
  }
  
  getCollaboratorCount(): number {
    return this.state.collaborators.length
  }
}
```