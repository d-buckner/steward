import { EventBus, EventHandler, EventSubscription } from '../types'
import { Message, ServiceActions, generateMessageId } from './Messages'
import { WorkerOptions } from './WorkerDecorator'

interface WorkerMessage {
  type: 'INIT_SERVICE' | 'SERVICE_MESSAGE' | 'STATE_CHANGE' | 'MESSAGE_RESPONSE' | 'SERVICE_EVENT'
  id?: string
  [key: string]: any
}

interface PendingMessage {
  resolve: (value: any) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

/**
 * Proxy that runs a service in a Web Worker and maintains the same interface
 * as a regular service for seamless worker integration
 */
export class WorkerProxy<
  TState extends Record<string, any> = Record<string, any>,
  Actions extends ServiceActions = {}
> implements EventBus {
  private worker!: Worker
  private pendingMessages = new Map<string, PendingMessage>()
  private eventListeners = new Map<string, Set<EventHandler<any>>>()
  private currentState: TState = {} as TState
  private isInitialized = false
  private initPromise: Promise<void>
  private resolveInit!: () => void
  private rejectInit!: (error: Error) => void

  /**
   * Strongly typed reactive state proxy
   * Access state properties directly: service.state.count
   */
  public readonly state: TState

  constructor(
    private serviceClass: any,
    private initialState: TState,
    private options: WorkerOptions = { name: 'WorkerService' }
  ) {
    this.currentState = { ...initialState }

    // Create state proxy that reads from current state
    this.state = new Proxy(this.currentState, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'string') {
          return this.currentState[prop as keyof TState]
        }
        return target[prop as keyof TState]
      },
      set: () => {
        throw new Error('Cannot directly modify service state. Use actions instead.')
      }
    }) as TState

    // Initialize worker
    this.initPromise = new Promise((resolve, reject) => {
      this.resolveInit = resolve
      this.rejectInit = reject
    })

    this.initializeWorker()
  }

  private async initializeWorker(): Promise<void> {
    try {
      // Get service name from class
      const serviceName = this.serviceClass.name || this.serviceClass.__workerServiceName
      console.log(`[WorkerProxy] 🚀 Starting initialization for service: ${serviceName}`)
      console.log(`[WorkerProxy] Service class:`, this.serviceClass)
      console.log(`[WorkerProxy] Worker options:`, this.options)

      // Try to get worker constructor from generated registry
      let workerConstructor: new () => Worker
      let workerUrl: URL | undefined

      try {
        // Dynamically import the registry from the consumer app's generated folder
        // Use the current base URL to build the correct path
        const registryUrl = new URL('/src/generated/worker-registry.ts', window.location.origin)
        console.log(`[WorkerProxy] 📁 Attempting to import registry from: ${registryUrl.href}`)
        console.log(`[WorkerProxy] 🌐 Current window.location:`, window.location)
        console.log(`[WorkerProxy] 🌐 Window location origin: ${window.location.origin}`)
        const registryModule = await import(/* @vite-ignore */ registryUrl.href)
        console.log(`[WorkerProxy] ✅ Registry module loaded:`, registryModule)
        console.log(`[WorkerProxy] 📋 Available worker bundles:`, registryModule.WORKER_BUNDLES)

        workerConstructor = registryModule.getWorkerBundle(serviceName)
        console.log(`[WorkerProxy] 🔍 getWorkerBundle(${serviceName}) returned:`, workerConstructor)

        if (!workerConstructor) {
          throw new Error(`No worker bundle found for service '${serviceName}' in generated registry`)
        }
        console.log(`[WorkerProxy] ✅ Using generated worker constructor for ${serviceName}`)
        console.log(`[WorkerProxy] 🔗 Worker constructor type:`, typeof workerConstructor)

        // Create worker using Vite's generated constructor
        console.log(`[WorkerProxy] 🏗️ Creating worker using Vite constructor`)
        this.worker = new workerConstructor()
        console.log(`[WorkerProxy] ✅ Worker instance created via constructor`)

      } catch (importError) {
        // Fallback for development/testing when registry might not exist
        console.warn(`[WorkerProxy] ⚠️ Generated registry not found (${(importError as Error).message}), falling back to default worker entry`)

        // Use custom worker entry if provided, otherwise default
        if (this.options.workerEntry) {
          workerUrl = new URL(this.options.workerEntry)
          console.log(`[WorkerProxy] 🔄 Using custom worker entry: ${workerUrl}`)
        } else {
          workerUrl = new URL('../worker/worker-entry.ts?worker', import.meta.url)
          console.log(`[WorkerProxy] 🔄 Using default worker entry: ${workerUrl}`)
        }

        console.log(`[WorkerProxy] 🏗️ Creating worker for ${serviceName}`)
        console.log(`[WorkerProxy] Worker URL: ${workerUrl}`)

        this.worker = new Worker(
          workerUrl,
          { type: 'module', name: this.options.name }
        )
      }
      console.log(`[WorkerProxy] ✅ Worker instance created successfully`)

      // Handle messages from worker
      this.worker.onmessage = this.handleWorkerMessage.bind(this)
      this.worker.onerror = this.handleWorkerError.bind(this)
      console.log(`[WorkerProxy] 📡 Message handlers attached`)

      console.log(`[WorkerProxy] 📤 Sending INIT_SERVICE message`)
      console.log(`[WorkerProxy] Service name: ${serviceName}`)
      console.log(`[WorkerProxy] Initial state:`, this.initialState)

      // Initialize service in worker
      this.worker.postMessage({
        type: 'INIT_SERVICE',
        serviceName: serviceName,
        initialState: this.initialState
      })
      console.log(`[WorkerProxy] ✅ INIT_SERVICE message sent`)

    } catch (error) {
      console.error(`[WorkerProxy] Initialization failed:`, error)
      this.rejectInit(error as Error)
    }
  }

  private handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
    const { type, id, ...data } = event.data
    console.log(`[WorkerProxy] 📥 Received message from worker:`, { type, id, ...data })

    switch (type) {
      case 'STATE_CHANGE': {
        const { key, value } = data
        console.log(`[WorkerProxy] 🔄 State change: ${key} = ${value}`)
        this.currentState[key as keyof TState] = value

        // Emit to local listeners
        this.emit(key, value)
        console.log(`[WorkerProxy] ✅ State change emitted to listeners`)
        break
      }

      case 'SERVICE_EVENT': {
        const { event, payload } = data
        console.log(`[WorkerProxy] 📡 Service event: ${event}`, payload)
        this.emit(event, payload)
        break
      }

      case 'MESSAGE_RESPONSE': {
        console.log(`[WorkerProxy] 💬 Message response for ID: ${id}`)
        if (id && this.pendingMessages.has(id)) {
          const pending = this.pendingMessages.get(id)!
          clearTimeout(pending.timeout)
          this.pendingMessages.delete(id)
          console.log(`[WorkerProxy] ✅ Found pending message, resolving`)

          if (data.error) {
            console.log(`[WorkerProxy] ❌ Message response contains error:`, data.error)
            pending.reject(new Error(data.error))
          } else {
            console.log(`[WorkerProxy] ✅ Message response success:`, data.result)
            pending.resolve(data.result)
          }
        } else {
          console.warn(`[WorkerProxy] ⚠️ No pending message found for ID: ${id}`)
        }
        break
      }

      case 'INIT_SERVICE': {
        console.log(`[WorkerProxy] 🎯 INIT_SERVICE response:`, data)
        if (data.success) {
          console.log(`[WorkerProxy] ✅ Worker initialization successful!`)
          this.isInitialized = true
          this.resolveInit()
        } else {
          console.error(`[WorkerProxy] ❌ Worker initialization failed:`, data.error)
          this.rejectInit(new Error(data.error || 'Worker initialization failed'))
        }
        break
      }

      default:
        console.warn(`[WorkerProxy] ⚠️ Unknown message type from worker: ${type}`)
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error(`[WorkerProxy] 💥 Worker error occurred:`, error)
    console.error(`[WorkerProxy] Error details:`, {
      message: error.message,
      filename: error.filename,
      lineno: error.lineno,
      colno: error.colno,
      error: error.error
    })

    if (!this.isInitialized) {
      console.error(`[WorkerProxy] 💥 Worker failed during initialization, rejecting init promise`)
      this.rejectInit(new Error(`Worker error: ${error.message}`))
    } else {
      console.error(`[WorkerProxy] 💥 Worker error after initialization - service may be unstable`)
    }
  }

  // EventBus interface implementation
  on<T = any>(event: string, handler: EventHandler<T>): EventSubscription {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    
    this.eventListeners.get(event)!.add(handler)
    
    return {
      unsubscribe: () => {
        const listeners = this.eventListeners.get(event)
        if (listeners) {
          listeners.delete(handler)
          if (listeners.size === 0) {
            this.eventListeners.delete(event)
          }
        }
      }
    }
  }

  off<T = any>(event: string, handler: EventHandler<T>): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(handler)
      if (listeners.size === 0) {
        this.eventListeners.delete(event)
      }
    }
  }

  once<T = any>(event: string, handler: EventHandler<T>): EventSubscription {
    const subscription = this.on(event, (value) => {
      handler(value)
      subscription.unsubscribe()
    })
    return subscription
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.eventListeners.delete(event)
    } else {
      this.eventListeners.clear()
    }
  }

  hasListeners(event: string): boolean {
    return this.eventListeners.has(event) && this.eventListeners.get(event)!.size > 0
  }

  getListenerCount(event: string): number {
    return this.eventListeners.get(event)?.size || 0
  }

  private emit<T = any>(event: string, value: T): void {
    console.log(`[WorkerProxy.emit] 📡 Emitting event: ${event} with value:`, value)
    console.log(`[WorkerProxy.emit] 👂 Listener count:`, this.getListenerCount(event))
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      console.log(`[WorkerProxy.emit] 🔊 Calling ${listeners.size} listeners for event: ${event}`)
      let index = 0
      listeners.forEach((handler) => {
        index++
        console.log(`[WorkerProxy.emit] 📞 Calling listener ${index} for ${event}`)
        handler(value)
        console.log(`[WorkerProxy.emit] ✅ Listener ${index} completed for ${event}`)
      })
    } else {
      console.log(`[WorkerProxy.emit] 🔇 No listeners found for event: ${event}`)
    }
  }

  // MessageHandler interface implementation
  async send<K extends keyof Actions>(
    type: K,
    payload: Actions[K],
    correlationId?: string
  ): Promise<void> {
    console.log(`[WorkerProxy.send] Sending message:`, { type, payload, correlationId })
    console.log(`[WorkerProxy.send] Init promise status:`, this.isInitialized)

    await this.initPromise
    console.log(`[WorkerProxy.send] After init promise resolved`)

    return new Promise((resolve, reject) => {
      const id = correlationId || generateMessageId()
      console.log(`[WorkerProxy.send] Generated message ID:`, id)

      const timeout = setTimeout(() => {
        console.log(`[WorkerProxy.send] Message timeout for:`, id, type)
        this.pendingMessages.delete(id)
        reject(new Error(`Worker message timeout: ${String(type)}`))
      }, 5000)

      this.pendingMessages.set(id, { resolve, reject, timeout })
      console.log(`[WorkerProxy.send] Pending messages count:`, this.pendingMessages.size)

      const message = {
        type: 'SERVICE_MESSAGE',
        id,
        messageType: type,
        payload
      }
      console.log(`[WorkerProxy.send] Posting message to worker:`, message)
      this.worker.postMessage(message)
    })
  }

  // Service interface methods
  getState(): Record<string, any> {
    return { ...this.currentState }
  }

  getMessageHistory(): Message<Actions>[] {
    // TODO: Could request from worker if needed
    return []
  }

  clearMessageHistory(): void {
    // TODO: Could send command to worker if needed
  }

  async replayMessages(_fromIndex = 0): Promise<void> {
    // TODO: Could send command to worker if needed
  }

  clear(): void {
    // Clean up
    this.removeAllListeners()
    
    // Reject all pending messages
    for (const [, pending] of this.pendingMessages) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Worker proxy disposed'))
    }
    this.pendingMessages.clear()

    // Terminate worker
    if (this.worker) {
      this.worker.terminate()
    }
  }
}