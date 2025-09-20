# Steward

When you're building a React application, things start simple enough. A few components, some local state, maybe a context or two. But as your app grows, you start running into familiar patterns: components that need to share state become tightly coupled, performance bottlenecks require moving work to Web Workers (which means rewriting your logic), and what started as clean, predictable code becomes increasingly complex to maintain.

What if we could learn from systems that have already solved these problems?

The Erlang BEAM virtual machine has been running fault-tolerant, distributed systems for decades. Its actor model - where isolated processes communicate purely through messages - has proven itself in everything from WhatsApp's messaging infrastructure to Discord's real-time chat. But these patterns have remained largely confined to backend systems.

Steward brings these battle-tested concepts to frontend development, creating a reactive service architecture where your application is built from isolated, message-driven services that can transparently scale from local execution to Web Workers to distributed systems.

## The Problem We're Solving

Consider a typical React application as it grows:

```tsx
// This starts simple...
function CodeEditor() {
  const [content, setContent] = useState('')
  const [diagnostics, setDiagnostics] = useState([])
  const [isLinting, setIsLinting] = useState(false)

  // But quickly becomes this...
  const [syntaxTree, setSyntaxTree] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [highlights, setHighlights] = useState([])
  const [symbols, setSymbols] = useState([])
  const [completionCache, setCompletionCache] = useState({})
  // ... and keeps growing
}
```

Now imagine you need that syntax parsing and linting to be really fast - maybe you're dealing with large files or complex analysis. You'd need to move the work to a Web Worker, which means:

1. Rewriting your logic to work with postMessage
2. Serializing/deserializing data across the worker boundary
3. Managing state synchronization between main thread and worker
4. Handling errors and cleanup across process boundaries

What started as a simple state update becomes a distributed systems problem.

## The Steward Approach

Instead of fighting against these constraints, we embrace them. Every piece of functionality becomes a service - a lightweight, isolated process that manages its own state and communicates purely through messages.

```typescript
// Build a code editor with multiple coordinating services
class DocumentService extends Service<DocumentState> {
  constructor() {
    super({
      content: '',
      syntaxTree: null,
      diagnostics: [],
      highlights: []
    })
  }

  updateContent(content: string) {
    this.setState('content', content)
    this.parseDocument(content)
  }

  parseDocument(content: string) {
    // Syntax highlighting and error detection
    const syntaxTree = this.buildSyntaxTree(content)
    const diagnostics = this.runLinting(content)
    const highlights = this.generateHighlights(syntaxTree)

    this.setState({ syntaxTree, diagnostics, highlights })
  }
}

class AutocompleteService extends Service<AutocompleteState> {
  constructor(private documentService: DocumentService) {
    super({ suggestions: [], isLoading: false })
  }

  async generateSuggestions(position: number) {
    this.setState('isLoading', true)

    // ML-powered intelligent completions
    const context = this.documentService.state.content
    const suggestions = await this.runInference(context, position)

    this.setState({ suggestions, isLoading: false })
  }
}
```

Your React components interact with services through a clean, reactive API:

```tsx
function CodeEditor() {
  const docState = useServiceState(DocumentToken)
  const autocompleteState = useServiceState(AutocompleteToken)
  const docActions = useServiceActions(DocumentToken)

  return (
    <div className="editor">
      <CodeMirror
        value={docState.content}
        onChange={docActions.updateContent}
        highlights={docState.highlights}
        diagnostics={docState.diagnostics}
      />

      <AutocompleteSuggestions
        suggestions={autocompleteState.suggestions}
        loading={autocompleteState.isLoading}
      />
    </div>
  )
}
```

But here's where it gets interesting. When your files get large and parsing starts blocking the UI, you don't rewrite anything:

```typescript
// Just add a decorator - same code, now runs in a Web Worker
@withWorker('DocumentProcessor')
class DocumentService extends Service<DocumentState> {
  // Exact same parsing logic - now non-blocking
}

@withWorker('MLInference')
class AutocompleteService extends Service<AutocompleteState> {
  // Heavy ML inference - now in dedicated worker
}
```

Your React components don't change. Your service logic doesn't change. The framework handles all the message passing, state synchronization, and error handling transparently.

## Location Transparency

This is the core insight from distributed systems that Steward brings to frontend development: **if your architecture is already message-driven, location becomes irrelevant**.

```typescript
// These services have identical APIs from your component's perspective:

// Runs in main thread - fast startup
class AutocompleteService extends Service { /* ... */ }

// Runs in Web Worker - heavy ML inference
@withWorker('MLInference')
class AutocompleteService extends Service { /* ... */ }

// Runs as remote service - your own inference API (future)
@withRemoteService('https://api.yourapp.com/autocomplete')
class AutocompleteService extends Service { /* ... */ }
```

Whether a service runs locally, in a worker, or on a remote server becomes an implementation detail, not an architectural constraint.

## Progressive Enhancement

You don't need to design for distribution from day one. Steward lets you start simple and add complexity only when you need it:

**Phase 1: Basic Editor**
```typescript
class DocumentService extends Service<DocumentState> {
  updateContent(content: string) {
    this.setState('content', content)
    this.highlightSyntax(content) // Simple regex-based highlighting
  }
}
```

**Phase 2: Add Intelligence**
```typescript
class DocumentService extends Service<DocumentState> {
  updateContent(content: string) {
    this.setState('content', content)
    this.parseAST(content)      // Full syntax tree
    this.runLinting(content)    // Error detection
    this.updateDiagnostics()    // Real-time feedback
  }
}
```

**Phase 3: Scale Performance**
```typescript
@withWorker('DocumentProcessor')
class DocumentService extends Service<DocumentState> {
  // Same parsing logic, now non-blocking
}
```

**Phase 4: Add Collaboration**
```typescript
@withCRDT({ type: 'text' })
@withWorker('DocumentProcessor')
class DocumentService extends Service<DocumentState> {
  // Same code, now supports real-time collaborative editing
}
```

## Quick Start

```bash
npm install @d-buckner/steward @steward/react
```

```typescript
// 1. Define your service
import { Service, createServiceToken, ServiceState } from '@d-buckner/steward'

interface EditorState extends ServiceState {
  content: string
  diagnostics: Diagnostic[]
  isLinting: boolean
}

class EditorService extends Service<EditorState> {
  constructor() {
    super({
      content: '',
      diagnostics: [],
      isLinting: false
    })
  }

  updateContent(content: string) {
    this.setState('content', content)
    this.lintContent(content)
  }

  async lintContent(content: string) {
    this.setState('isLinting', true)
    const diagnostics = await this.runLinter(content)
    this.setState({ diagnostics, isLinting: false })
  }

  private async runLinter(content: string): Promise<Diagnostic[]> {
    // Your linting logic here
    return []
  }
}

export const EditorToken = createServiceToken<EditorService>('editor')
```

```tsx
// 2. Use in React
import { useServiceState, useServiceActions } from '@steward/react'

function CodeEditor() {
  const state = useServiceState(EditorToken)
  const actions = useServiceActions(EditorToken)

  return (
    <div className="editor">
      <textarea
        value={state.content}
        onChange={(e) => actions.updateContent(e.target.value)}
        placeholder="Start typing code..."
      />

      {state.isLinting && <div className="spinner">Linting...</div>}

      <DiagnosticsPanel diagnostics={state.diagnostics} />
    </div>
  )
}

// Or use destructuring for cleaner code
function CodeEditorWithDestructuring() {
  const { content, diagnostics, isLinting } = useServiceState(EditorToken)
  const { updateContent } = useServiceActions(EditorToken)

  return (
    <div className="editor">
      <textarea
        value={content}
        onChange={(e) => updateContent(e.target.value)}
        placeholder="Start typing code..."
      />

      {isLinting && <div className="spinner">Linting...</div>}
      <DiagnosticsPanel diagnostics={diagnostics} />
    </div>
  )
}
```

```typescript
// 3. Scale when needed
@withWorker('EditorProcessor')
class EditorService extends Service<EditorState> {
  // Same linting logic, now runs in worker for non-blocking performance
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

## Headless Usage

Steward also works outside of UI frameworks through the headless ServiceClient API:

```typescript
import { createServiceClient, useService } from '@d-buckner/steward'

// Direct client usage
const client = createServiceClient(container, CounterToken)

// Same API as UI packages
console.log(client.state.count) // Direct access
const { count } = client.state  // Destructuring support

await client.actions.increment() // Direct actions
const { increment } = client.actions // Destructuring support

// Or use the convenience function
const { state, actions, dispose } = useService(container, CounterToken)
const { count } = state
const { increment } = actions

await increment()
console.log(count) // Updated value
```

This makes Steward perfect for Node.js backends, CLI tools, testing environments, or any JavaScript environment where you need reactive state management.

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
