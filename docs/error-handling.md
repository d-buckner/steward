# Error Handling in Steward

Steward uses reactive error state rather than exceptions, making error handling predictable and UI-friendly. Errors become part of your service's normal state, allowing components to respond reactively.

## Basic Error State Pattern

Add an `error` field to your service state with specific error codes:

```typescript
interface FileServiceState extends ServiceState {
  files: File[]
  uploading: boolean
  progress: number
  error: 'NETWORK_ERROR' | 'FILE_TOO_LARGE' | 'INVALID_FORMAT' | null
}

class FileService extends Service<FileServiceState> {
  constructor() {
    super({
      files: [],
      uploading: false,
      progress: 0,
      error: null
    })
  }

  async uploadFile(file: File) {
    // Clear previous errors
    if (this.state.error) {
      this.setState('error', null)
    }

    // Validate file
    if (file.size > 10 * 1024 * 1024) {
      this.setState('error', 'FILE_TOO_LARGE')
      return
    }

    this.setState('uploading', true)

    try {
      await this.performUpload(file)
      this.setState({ uploading: false, progress: 100 })
    } catch (error) {
      this.setState({
        uploading: false,
        error: 'NETWORK_ERROR'
      })
    }
  }

  clearError() {
    this.setState('error', null)
  }
}
```

## React Component Error Handling

Components handle errors through normal state subscriptions:

```tsx
function FileUploader() {
  const { files, uploading, progress, error } = useServiceState(FileToken)
  const { uploadFile, clearError } = useServiceActions(FileToken)

  // Handle different error states
  if (error === 'FILE_TOO_LARGE') {
    return (
      <div className="error-panel">
        <p>File is too large (max 10MB)</p>
        <button onClick={clearError}>Try Again</button>
      </div>
    )
  }

  if (error === 'NETWORK_ERROR') {
    return (
      <div className="error-panel">
        <p>Upload failed. Check your connection.</p>
        <button onClick={clearError}>Retry</button>
      </div>
    )
  }

  return (
    <div className="uploader">
      <input
        type="file"
        onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
        disabled={uploading}
      />

      {uploading && (
        <div className="progress">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
```

## SolidJS Component Error Handling

```tsx
function FileUploader() {
  const state = createServiceState(FileToken)
  const actions = createServiceActions(FileToken)

  return (
    <div class="uploader">
      <Switch>
        <Match when={state.error === 'FILE_TOO_LARGE'}>
          <div class="error-panel">
            <p>File is too large (max 10MB)</p>
            <button onClick={actions.clearError}>Try Again</button>
          </div>
        </Match>

        <Match when={state.error === 'NETWORK_ERROR'}>
          <div class="error-panel">
            <p>Upload failed. Check your connection.</p>
            <button onClick={actions.clearError}>Retry</button>
          </div>
        </Match>

        <Match when={!state.error}>
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) actions.uploadFile(file)
            }}
            disabled={state.uploading}
          />

          <Show when={state.uploading}>
            <div class="progress">
              <div class="progress-bar" style={{ width: `${state.progress}%` }} />
            </div>
          </Show>
        </Match>
      </Switch>
    </div>
  )
}
```

## Advanced Error Patterns

### Hierarchical Error Codes

```typescript
interface DatabaseState extends ServiceState {
  connected: boolean
  syncing: boolean
  error:
    | 'CONNECTION_FAILED'
    | 'AUTH_EXPIRED'
    | 'SYNC_CONFLICT'
    | 'QUOTA_EXCEEDED'
    | null
}

class DatabaseService extends Service<DatabaseState> {
  async connect() {
    try {
      await this.establishConnection()
      this.setState({ connected: true, error: null })
    } catch (error) {
      if (error.code === 'AUTH_INVALID') {
        this.setState('error', 'AUTH_EXPIRED')
      } else {
        this.setState('error', 'CONNECTION_FAILED')
      }
    }
  }
}
```

### Error Recovery Strategies

```typescript
interface AudioState extends ServiceState {
  recording: boolean
  volume: number
  error: 'MIC_DENIED' | 'AUDIO_CONTEXT_FAILED' | 'RECORDING_TOO_LONG' | null
  retryCount: number
}

class AudioService extends Service<AudioState> {
  async startRecording() {
    // Auto-retry logic
    if (this.state.error === 'AUDIO_CONTEXT_FAILED' && this.state.retryCount < 3) {
      this.setState('retryCount', this.state.retryCount + 1)
      setTimeout(() => this.startRecording(), 1000)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.setState({
        recording: true,
        error: null,
        retryCount: 0
      })
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        this.setState('error', 'MIC_DENIED')
      } else {
        this.setState('error', 'AUDIO_CONTEXT_FAILED')
      }
    }
  }
}
```

### Global Error States

```typescript
interface AppState extends ServiceState {
  online: boolean
  globalError: 'NETWORK_OFFLINE' | 'SESSION_EXPIRED' | 'MAINTENANCE_MODE' | null
}

class AppService extends Service<AppState> {
  constructor() {
    super({
      online: navigator.onLine,
      globalError: null
    })

    // Listen for network changes
    window.addEventListener('online', () => {
      this.setState({ online: true, globalError: null })
    })

    window.addEventListener('offline', () => {
      this.setState({ online: false, globalError: 'NETWORK_OFFLINE' })
    })
  }

  handleApiError(response: Response) {
    if (response.status === 401) {
      this.setState('globalError', 'SESSION_EXPIRED')
    } else if (response.status === 503) {
      this.setState('globalError', 'MAINTENANCE_MODE')
    }
  }
}
```

## Best Practices

### 1. Use Specific Error Codes
```typescript
// ❌ Generic error
error: string | null

// ✅ Specific error codes
error: 'NETWORK_TIMEOUT' | 'INVALID_CREDENTIALS' | 'QUOTA_EXCEEDED' | null
```

### 2. Auto-Clear Errors on Success
```typescript
async saveData(data: any) {
  // Clear error when retrying
  if (this.state.error) {
    this.setState('error', null)
  }

  try {
    await this.performSave(data)
    // Success - error remains null
  } catch (error) {
    this.setState('error', 'SAVE_FAILED')
  }
}
```

### 3. Provide Error Recovery Actions
```typescript
// Always provide a way to clear errors
clearError() {
  this.setState('error', null)
}

// Or specific recovery actions
retryConnection() {
  this.setState('error', null)
  this.connect()
}
```

### 4. Handle Errors at the Right Level
```typescript
// Service-level validation errors
validateInput(input: string) {
  if (input.length === 0) {
    this.setState('error', 'INPUT_REQUIRED')
    return false
  }
  return true
}

// Network-level errors
async fetchData() {
  try {
    const data = await api.getData()
    this.setState({ data, error: null })
  } catch (error) {
    this.setState('error', 'NETWORK_ERROR')
  }
}
```

## Error State vs Exceptions

### When to Use Error State
- **User-facing errors** - validation, network issues, permissions
- **Recoverable errors** - retry scenarios, optional features
- **State-dependent errors** - errors that affect how UI should render

### When Exceptions Are OK
- **Programming errors** - bugs that should crash during development
- **Initialization failures** - problems during service setup
- **Critical system errors** - unrecoverable failures

```typescript
class PaymentService extends Service<PaymentState> {
  processPayment(amount: number) {
    // Programming error - should throw
    if (amount <= 0) {
      throw new Error('Payment amount must be positive')
    }

    // User error - should set error state
    if (amount > this.state.balance) {
      this.setState('error', 'INSUFFICIENT_FUNDS')
      return
    }

    // Process payment...
  }
}
```

This pattern makes error handling predictable, testable, and provides excellent developer experience through TypeScript's exhaustive checking of union types.