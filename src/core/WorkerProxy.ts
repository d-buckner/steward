import { EventBus, EventHandler, EventSubscription } from '../types'
import { Message, MessageDefinition, generateMessageId } from './Messages'
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
  Messages extends MessageDefinition = {}
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
    private options: WorkerOptions = {}
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
      // Create worker with the worker entry point
      this.worker = new Worker(
        new URL('../worker/worker-entry.ts?worker', import.meta.url),
        { type: 'module', name: this.options.name }
      )

      // Handle messages from worker
      this.worker.onmessage = this.handleWorkerMessage.bind(this)
      this.worker.onerror = this.handleWorkerError.bind(this)

      // Initialize service in worker
      this.worker.postMessage({
        type: 'INIT_SERVICE',
        serviceCode: this.serviceClass.__workerServiceCode,
        serviceName: this.serviceClass.__workerServiceName,
        initialState: this.initialState,
        messageTypes: this.serviceClass.__messageTypes,
        actionCreators: this.serviceClass.__actionCreators
      })

    } catch (error) {
      this.rejectInit(error as Error)
    }
  }

  private handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
    const { type, id, ...data } = event.data

    switch (type) {
      case 'STATE_CHANGE': {
        const { key, value } = data
        this.currentState[key as keyof TState] = value
        
        // Emit to local listeners
        this.emit(key, value)
        break
      }

      case 'SERVICE_EVENT': {
        const { event, payload } = data
        this.emit(event, payload)
        break
      }

      case 'MESSAGE_RESPONSE': {
        if (id && this.pendingMessages.has(id)) {
          const pending = this.pendingMessages.get(id)!
          clearTimeout(pending.timeout)
          this.pendingMessages.delete(id)

          if (data.error) {
            pending.reject(new Error(data.error))
          } else {
            pending.resolve(data.result)
          }
        }
        break
      }

      case 'INIT_SERVICE': {
        if (data.success) {
          this.isInitialized = true
          this.resolveInit()
        } else {
          this.rejectInit(new Error(data.error || 'Worker initialization failed'))
        }
        break
      }
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('Worker error:', error)
    if (!this.isInitialized) {
      this.rejectInit(new Error(`Worker error: ${error.message}`))
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
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(handler => handler(value))
    }
  }

  // MessageHandler interface implementation
  async send<K extends keyof Messages>(
    type: K,
    payload: Messages[K],
    correlationId?: string
  ): Promise<void> {
    await this.initPromise
    
    return new Promise((resolve, reject) => {
      const id = correlationId || generateMessageId()
      
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id)
        reject(new Error(`Worker message timeout: ${String(type)}`))
      }, 5000)

      this.pendingMessages.set(id, { resolve, reject, timeout })

      this.worker.postMessage({
        type: 'SERVICE_MESSAGE',
        id,
        messageType: type,
        payload
      })
    })
  }

  // Service interface methods
  getState(): Record<string, any> {
    return { ...this.currentState }
  }

  getMessageHistory(): Message<Messages>[] {
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