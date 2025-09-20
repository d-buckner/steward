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

### Message-Driven Services

Services automatically route messages to public methods based on method names. Actions are automatically derived from your method signatures - no manual interfaces needed!

```typescript
class Service<State>
```

#### Methods

- `send<K extends keyof Actions>(type: K, payload: Actions[K]): void` - Send message
- `request<ReqKey, ResKey>(requestType: ReqKey, payload: Actions[ReqKey], responseType: ResKey, timeout?: number): Promise<Actions[ResKey]>` - Request/response pattern

#### Example

```typescript
// Just define your state and methods - actions are automatic!
class AuthService extends Service<AuthState> {
  async login(username: string, password: string) {
    // Handle login
    const user = await this.authenticate(username, password)
    this.send('loginSuccess', [user])
  }

  logout() {
    // Handle logout
    this.setState('user', null)
  }

  loginSuccess(user: User) {
    this.setState('user', user)
  }

  loginFailed(error: string) {
    this.setState('error', error)
  }
}

// Actions are automatically:
// { login: [string, string], logout: [], loginSuccess: [User], loginFailed: [string] }
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

## Utilities

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

### ServiceActions

```typescript
type ServiceActions = {
  [actionName: string]: unknown[]
}
```

Defines action types where:
- Action names should be camelCase (e.g., `addItem`, `deleteUser`)
- Payloads must be arrays (e.g., `[text: string, priority: number]`)
- Each action corresponds to a public method on the service

### ExtractActions (Advanced)

```typescript
type ExtractActions<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any
    ? K extends string
      ? K extends BaseServiceMethods
        ? never
        : K
      : never
    : never]: T[K] extends (...args: infer P) => any ? P : never
}
```

Utility type for advanced scenarios where you need to explicitly extract action types from a service class. This is automatically used by the Service class, so you typically don't need to use it directly:

```typescript
class TodoService extends Service<TodoState> {
  addItem(text: string) { /* ... */ }
  toggleItem(id: string) { /* ... */ }
  setFilter(filter: string) { /* ... */ }
}

// For advanced use cases, you can explicitly extract the action types:
type TodoActions = ExtractActions<TodoService>
// Result: { addItem: [string], toggleItem: [string], setFilter: [string] }
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