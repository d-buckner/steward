/**
 * Reliable Worker Proxy
 *
 * A simplified WorkerProxy that:
 * - Automatically falls back to main thread when worker fails
 * - Uses pure message passing instead of method dispatch
 * - Has reliable error handling and recovery
 * - Maintains mailbox architecture principles
 */

import { EventBus, EventHandler, EventSubscription } from '../types'
import { ServiceActions, generateMessageId } from './Messages'

interface WorkerMessage {
  type: 'INIT_SERVICE' | 'SERVICE_MESSAGE' | 'STATE_CHANGE' | 'MESSAGE_RESPONSE' | 'WORKER_ERROR'
  id?: string
  key?: string
  value?: any
  messageType?: string
  payload?: any
  result?: any
  error?: string
  success?: boolean
  initialState?: any
}

interface PendingMessage {
  resolve: (value: any) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

/**
 * Reliable WorkerProxy that automatically falls back to main thread
 */
export class ReliableWorkerProxy<
  TState extends Record<string, any> = Record<string, any>,
  Actions extends ServiceActions = {}
> implements EventBus {
  private worker: Worker | null = null
  private fallbackService: any = null
  private isUsingWorker: boolean = false
  private isInitialized: boolean = false
  private currentState: TState
  private eventListeners = new Map<string, Set<EventHandler<any>>>()
  private pendingMessages = new Map<string, PendingMessage>()

  /**
   * Strongly typed reactive state proxy
   */
  public readonly state: TState

  constructor(
    private serviceClass: new (...args: any[]) => any,
    private initialState: TState
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
  }

  /**
   * Initialize the proxy with optional worker URL
   * Falls back to main thread if worker fails
   */
  async initialize(workerUrl?: string): Promise<void> {
    if (workerUrl) {
      try {
        await this.initializeWorker(workerUrl)
      } catch (error) {
        console.warn('[ReliableWorkerProxy] Worker initialization failed, falling back to main thread:', error)
        await this.initializeMainThread()
      }
    } else {
      await this.initializeMainThread()
    }
  }

  /**
   * Initialize with worker
   */
  private async initializeWorker(workerUrl: string): Promise<void> {
    this.worker = new Worker(workerUrl, { type: 'module' })
    this.isUsingWorker = true

    // Set up message handling
    this.worker.onmessage = this.handleWorkerMessage.bind(this)
    this.worker.onerror = this.handleWorkerError.bind(this)

    // Initialize service in worker
    this.worker.postMessage({
      type: 'INIT_SERVICE',
      initialState: this.initialState
    })

    // Wait for initialization with timeout
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'))
      }, 5000)

      const originalOnMessage = this.worker!.onmessage

      this.worker!.onmessage = (event) => {
        if (event.data.type === 'INIT_SERVICE') {
          clearTimeout(timeout)
          this.isInitialized = true
          this.worker!.onmessage = originalOnMessage

          if (event.data.success) {
            resolve()
          } else {
            reject(new Error(event.data.error || 'Worker initialization failed'))
          }
        } else {
          originalOnMessage?.(event)
        }
      }
    })
  }

  /**
   * Initialize with main thread service
   */
  private async initializeMainThread(): Promise<void> {
    this.isUsingWorker = false
    this.fallbackService = new this.serviceClass(this.initialState)
    this.isInitialized = true

    // Set up state monitoring for fallback service
    Object.keys(this.initialState).forEach(key => {
      this.fallbackService.on(key, (value: any) => {
        this.currentState[key as keyof TState] = value
        this.emit(key, value)
      })
    })
  }

  /**
   * Fallback to main thread when worker fails
   */
  private async fallbackToMainThread(): Promise<void> {
    if (this.isUsingWorker && this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    this.isUsingWorker = false
    this.fallbackService = new this.serviceClass(this.currentState) // Use current state
    this.isInitialized = true

    // Set up state monitoring
    Object.keys(this.currentState).forEach(key => {
      this.fallbackService.on(key, (value: any) => {
        this.currentState[key as keyof TState] = value
        this.emit(key, value)
      })
    })

    // Reject all pending messages
    for (const [, pending] of this.pendingMessages) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Worker failed - using main thread fallback'))
    }
    this.pendingMessages.clear()
  }

  /**
   * Handle messages from worker
   */
  private handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
    const { type, key, value, id, result, error } = event.data

    switch (type) {
      case 'STATE_CHANGE':
        if (key) {
          this.currentState[key as keyof TState] = value
          this.emit(key, value)
        }
        break

      case 'MESSAGE_RESPONSE':
        if (id && this.pendingMessages.has(id)) {
          const pending = this.pendingMessages.get(id)!
          clearTimeout(pending.timeout)
          this.pendingMessages.delete(id)

          if (error) {
            pending.reject(new Error(error))
          } else {
            pending.resolve(result)
          }
        }
        break
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('[ReliableWorkerProxy] Worker error:', error)
    this.fallbackToMainThread()
  }

  /**
   * Send message to service (worker or main thread)
   */
  async send<K extends keyof Actions>(
    messageType: K,
    payload: Actions[K]
  ): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    if (this.isUsingWorker && this.worker) {
      return this.sendToWorker(String(messageType), payload)
    } else if (this.fallbackService) {
      return this.sendToMainThread(String(messageType), payload)
    } else {
      throw new Error('No service available')
    }
  }

  /**
   * Send message to worker
   */
  private async sendToWorker(messageType: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = generateMessageId()
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id)
        // Auto-fallback on timeout
        this.fallbackToMainThread()
        reject(new Error('Worker timeout - falling back to main thread'))
      }, 5000)

      this.pendingMessages.set(id, { resolve, reject, timeout })

      this.worker!.postMessage({
        type: 'SERVICE_MESSAGE',
        id,
        messageType,
        payload: Array.isArray(payload) ? payload : [payload]
      })
    })
  }

  /**
   * Send message to main thread service
   */
  private async sendToMainThread(messageType: string, payload: any): Promise<any> {
    const method = this.fallbackService[messageType]
    if (typeof method === 'function') {
      const args = Array.isArray(payload) ? payload : [payload]
      return await method.apply(this.fallbackService, args)
    }
    throw new Error(`Method ${messageType} not found on service`)
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

  /**
   * Get current state
   */
  getState(): Record<string, any> {
    return { ...this.currentState }
  }

  /**
   * Clean up resources
   */
  clear(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    if (this.fallbackService) {
      this.fallbackService.clear()
      this.fallbackService = null
    }

    this.removeAllListeners()

    // Reject all pending messages
    for (const [, pending] of this.pendingMessages) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Service disposed'))
    }
    this.pendingMessages.clear()

    this.isInitialized = false
    this.isUsingWorker = false
  }
}