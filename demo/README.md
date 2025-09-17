# Steward + SolidJS Interactive Demo

An interactive demonstration of the Steward service-based architecture library with SolidJS integration.

## 🚀 Features Demonstrated

### 🔢 Counter Demo
- **Strongly typed state proxy** with `service.state.property` access
- **Reactive SolidJS primitives** with fine-grained updates
- **Type-safe state management** with full TypeScript IntelliSense
- Undo/redo functionality and statistics

### 📝 Todo Demo  
- **Message-driven architecture** with `@withMessages` decorator
- **Expressive action APIs** with multi-parameter methods
- **Complex state management** with filtering and search
- **Async operations** with loading states
- Priority system and due dates

### 💬 Chat Demo
- **Real-time messaging** simulation
- **Async message handling** with typing indicators  
- **Complex state interactions** with user management
- **Bot responses** and system messages
- Message statistics and history

## 🛠️ Technology Stack

- **Steward**: Service-based architecture with dependency injection
- **SolidJS**: Fine-grained reactive primitives
- **TypeScript**: Full type safety throughout
- **Vite**: Fast development and build tooling

## 📦 Installation & Usage

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🏗️ Architecture Highlights

### Service Definition
```typescript
class CounterService extends Service<{ count: number }> {
  increment() {
    // Strongly typed state access
    this.setState('count', this.state.count + 1)
  }
}
```

### SolidJS Integration
```typescript
function Counter() {
  const count = createServiceState('counter', 'count')
  const actions = createServiceActions('counter')
  
  return (
    <button onClick={actions.increment}>
      Count: {count()}
    </button>
  )
}
```

### Message-Driven Services
```typescript
@withMessages(['ADD_ITEM'], {
  ADD_ITEM: (text: string, priority: number = 0) => ({ text, priority })
})
class TodoService extends MessageService<State, Messages> {
  async handle(message: Message<Messages>) {
    // Handle messages with full type safety
  }
}
```

## 🎯 Key Concepts Demonstrated

1. **Strongly Typed State Proxy**: Access state properties directly with `service.state.property`
2. **Fine-grained Reactivity**: SolidJS primitives update only what changed
3. **Message-driven Architecture**: Pure message handlers with expressive APIs
4. **Dependency Injection**: Type-safe service container with automatic resolution
5. **Async Operations**: Loading states and complex async workflows
6. **Type Safety**: Full TypeScript support throughout the stack

## 🔗 Links

- [Steward Repository](https://github.com/d-buckner/steward)
- [SolidJS Documentation](https://solidjs.com)
- [Vite Documentation](https://vitejs.dev)

## 📄 License

MIT © [Daniel Buckner](https://github.com/d-buckner)