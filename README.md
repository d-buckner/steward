# Steward

Steward is a frontend framework that makes modeling complex business logic simple by organizing your application into services - isolated processes that manage their own state and communicate through messages.

This service-based approach helps you build applications that naturally reflect your business domains while solving common frontend scaling problems:

- **Location transparency** - services run locally, in workers, or remotely with identical APIs
- **Isolated failures** - service crashes don't affect other parts of your app
- **Fine-grained reactivity** - state updates only trigger necessary re-renders
- **Progressive scaling** - start simple, add complexity only when needed

The architecture is inspired by Erlang's actor model, where isolated processes communicate through messages. This pattern has proven effective in systems like WhatsApp's messaging infrastructure and Discord's real-time chat.

Steward brings these patterns to frontend development, letting you start simple and add complexity only when needed.

## How Steward Works

Steward organizes your application logic into services that naturally model your business domains:


```typescript
// Each service models a specific business domain
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
    // Rich document analysis
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

    // AI-powered suggestions based on document context
    const context = this.documentService.state.content
    const suggestions = await this.runInference(context, position)

    this.setState({ suggestions, isLoading: false })
  }
}
```

Your UI components interact with services through a clean, reactive API:

```tsx
// React example
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

// SolidJS example
function CodeEditor() {
  const docState = createServiceState(DocumentToken)
  const autocompleteState = createServiceState(AutocompleteToken)
  const docActions = createServiceActions(DocumentToken)

  return (
    <div class="editor">
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

When you need better performance, simply add a decorator to move services to their own threads:

```typescript
// Add a decorator to run in dedicated threads
@withWorker('DocumentProcessor')
class DocumentService extends Service<DocumentState> {
  // Same parsing logic - now non-blocking
}

@withWorker('MLInference')
class AutocompleteService extends Service<AutocompleteState> {
  // AI inference in dedicated thread
}
```

Your UI components stay the same. Your service logic stays the same. Steward handles all the threading, state synchronization, and communication automatically.

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
npm install @d-buckner/steward
```

For React:
```bash
npm install @steward/react
```

For SolidJS:
```bash
npm install @steward/solid
```

Add the Vite plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import { stewardWorkerPlugin } from '@d-buckner/steward/vite'

export default defineConfig({
  plugins: [
    stewardWorkerPlugin(),
    // your other plugins
  ],
})
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
```

```tsx
// 2. Use in SolidJS
import { createServiceState, createServiceActions } from '@steward/solid'

function CodeEditor() {
  const state = createServiceState(EditorToken)
  const actions = createServiceActions(EditorToken)

  return (
    <div class="editor">
      <textarea
        value={state.content}
        onInput={(e) => actions.updateContent(e.currentTarget.value)}
        placeholder="Start typing code..."
      />

      <Show when={state.isLinting}>
        <div class="spinner">Linting...</div>
      </Show>

      <DiagnosticsPanel diagnostics={state.diagnostics} />
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

## Error Handling

Steward uses reactive error state rather than exceptions, making error handling predictable and UI-friendly:

```typescript
interface AudioState extends ServiceState {
  isRecording: boolean
  volume: number
  error: 'MICROPHONE_ACCESS_DENIED' | 'AUDIO_ENGINE_FAILED' | 'RECORDING_TOO_LONG' | null
}

class AudioService extends Service<AudioState> {
  constructor() {
    super({
      isRecording: false,
      volume: 0,
      error: null
    })
  }

  async startRecording() {
    // Clear previous errors
    if (this.state.error) {
      this.setState('error', null)
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.setState('isRecording', true)
      this.initializeAudioEngine(stream)
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        this.setState('error', 'MICROPHONE_ACCESS_DENIED')
      } else {
        this.setState('error', 'AUDIO_ENGINE_FAILED')
      }
    }
  }

  stopRecording() {
    if (this.state.isRecording) {
      this.setState('isRecording', false)
      this.setState('error', null)
    }
  }

  clearError() {
    this.setState('error', null)
  }
}
```

Your components handle errors reactively through normal state:

```tsx
function AudioRecorder() {
  const { isRecording, volume, error } = useServiceState(AudioToken)
  const { startRecording, stopRecording, clearError } = useServiceActions(AudioToken)

  // Handle errors in your UI
  if (error === 'MICROPHONE_ACCESS_DENIED') {
    return (
      <div className="error-panel">
        <p>Microphone access is required for recording</p>
        <button onClick={() => clearError()}>Try Again</button>
      </div>
    )
  }

  if (error === 'AUDIO_ENGINE_FAILED') {
    return (
      <div className="error-panel">
        <p>Audio system failed to initialize</p>
        <button onClick={() => clearError()}>Retry</button>
      </div>
    )
  }

  return (
    <div className="recorder">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={!!error}
      >
        {isRecording ? 'Stop' : 'Start'} Recording
      </button>

      {isRecording && <VolumeIndicator level={volume} />}
    </div>
  )
}
```

## Real-World Examples

### File Upload Service
```typescript
interface FileUploadState extends ServiceState {
  files: UploadFile[]
  uploading: boolean
  progress: number
  error: 'NETWORK_ERROR' | 'FILE_TOO_LARGE' | 'INVALID_FORMAT' | null
}

class FileUploadService extends Service<FileUploadState> {
  constructor() {
    super({
      files: [],
      uploading: false,
      progress: 0,
      error: null
    })
  }

  addFiles(fileList: FileList) {
    const newFiles = Array.from(fileList).map(file => ({
      id: generateId(),
      file,
      status: 'pending' as const
    }))

    // Validate file sizes
    const invalidFiles = newFiles.filter(f => f.file.size > 10 * 1024 * 1024)
    if (invalidFiles.length > 0) {
      this.setState('error', 'FILE_TOO_LARGE')
      return
    }

    this.setState('files', [...this.state.files, ...newFiles])
  }

  async uploadFiles() {
    this.setState({ uploading: true, progress: 0, error: null })

    try {
      for (let i = 0; i < this.state.files.length; i++) {
        await this.uploadFile(this.state.files[i])
        this.setState('progress', ((i + 1) / this.state.files.length) * 100)
      }
    } catch (error) {
      this.setState('error', 'NETWORK_ERROR')
    } finally {
      this.setState('uploading', false)
    }
  }
}
```

### Real-time Chat Service
```typescript
interface ChatState extends ServiceState {
  messages: Message[]
  typing: User[]
  connected: boolean
  error: 'CONNECTION_LOST' | 'RATE_LIMITED' | null
}

class ChatService extends Service<ChatState> {
  private ws?: WebSocket

  constructor() {
    super({
      messages: [],
      typing: [],
      connected: false,
      error: null
    })
  }

  connect() {
    this.ws = new WebSocket('wss://chat.example.com')

    this.ws.onopen = () => {
      this.setState({ connected: true, error: null })
    }

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'message') {
        this.setState('messages', [...this.state.messages, data.message])
      } else if (data.type === 'typing') {
        this.setState('typing', data.users)
      }
    }

    this.ws.onclose = () => {
      this.setState({ connected: false, error: 'CONNECTION_LOST' })
      // Auto-reconnect logic
      setTimeout(() => this.connect(), 5000)
    }
  }

  sendMessage(content: string) {
    if (!this.state.connected) return

    const message = {
      id: generateId(),
      content,
      timestamp: Date.now(),
      user: getCurrentUser()
    }

    // Optimistic update
    this.setState('messages', [...this.state.messages, message])

    this.ws?.send(JSON.stringify({
      type: 'message',
      message
    }))
  }
}
```

## Live Examples

See the architecture in action: **[Demo](https://steward-demo.vercel.app)**

- **Counter**: Basic reactive service patterns
- **Todos**: Message-driven state management
- **Chat**: Real-time service communication
- **Data Processing**: Worker services handling millions of items
- **File Upload**: Progress tracking and error handling
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
| `@d-buckner/steward` | Core service architecture with Web Worker support | ✅ Production |
| `@steward/react` | React hooks and providers | ✅ Production |
| `@steward/solid` | SolidJS primitives | ✅ Production |
| `@d-buckner/steward-collaboration` | CRDT-based collaboration with Automerge | 🚧 Alpha |

## Documentation

- [**Getting Started**](./docs/getting-started.md) - Build your first Steward application
- [**Architecture Guide**](./docs/architecture.md) - Core concepts and patterns
- [**API Reference**](./docs/api.md) - Complete API documentation
- [**React Integration**](./packages/react/README.md) - React hooks and patterns
- [**SolidJS Integration**](./packages/solid/README.md) - SolidJS primitives and patterns
- [**Worker Guide**](./docs/workers.md) - Using services in Web Workers

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
