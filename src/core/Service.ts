import { ServiceEventBus } from './ServiceEventBus'
import { EventBus, EventHandler, EventSubscription } from '../types'
import { 
  MessageDefinition, 
  Message, 
  MessageHandler, 
  createMessage, 
  generateMessageId 
} from './Messages'

/**
 * Message-driven service with reactive state management
 * All services in Steward should extend this class for pure message-passing architecture
 */
export abstract class Service<
  TState extends Record<string, any> = Record<string, any>,
  Messages extends MessageDefinition = {}
> implements EventBus, MessageHandler<Messages> {
  private eventBus = new ServiceEventBus<TState>()
  private _state: TState
  private messageHistory: Message<Messages>[] = []
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    responseType: keyof Messages
    timeout: NodeJS.Timeout
  }>()
  
  /**
   * Strongly typed reactive state proxy
   * Access state properties directly: service.state.count
   */
  public readonly state: TState
  
  constructor(initialState: TState) {
    this._state = { ...initialState }
    
    // Create reactive state proxy
    this.state = new Proxy(this._state, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'string') {
          return this.eventBus.get(prop as keyof TState)
        }
        return target[prop as keyof TState]
      },
      set: () => {
        throw new Error('Cannot directly modify service state. Use setState() or updateState() instead.')
      }
    }) as TState
    
    // Emit initial state for all keys
    Object.entries(initialState).forEach(([key, value]) => {
      this.eventBus.emit(key as keyof TState, value as TState[keyof TState])
    })
  }
  
  // EventBus interface implementation
  on<T = any>(event: string, handler: EventHandler<T>): EventSubscription {
    return this.eventBus.on(event as keyof TState, handler)
  }
  
  off<T = any>(event: string, handler: EventHandler<T>): void {
    this.eventBus.off(event as keyof TState, handler)
  }
  
  once<T = any>(event: string, handler: EventHandler<T>): EventSubscription {
    return this.eventBus.once(event as keyof TState, handler)
  }
  
  removeAllListeners(event?: string): void {
    this.eventBus.removeAllListeners(event as keyof TState)
  }
  
  hasListeners(event: string): boolean {
    return this.eventBus.hasListeners(event as keyof TState)
  }
  
  getListenerCount(event: string): number {
    return this.eventBus.getListenerCount(event as keyof TState)
  }
  
  /**
   * Update multiple state properties at once
   * Convenience method that calls setStates internally
   */
  protected updateState(updates: Partial<TState>): void {
    this.setStates(updates)
  }
  
  public getState(): Record<string, any> {
    return this.eventBus.getState()
  }
  
  /**
   * Set a single state property and emit event
   */
  protected setState<K extends keyof TState>(key: K, value: TState[K]): void {
    this._state[key] = value
    this.eventBus.emit(key, value)
  }
  
  /**
   * Set multiple state properties and emit events
   */
  protected setStates(updates: Partial<TState>): void {
    Object.entries(updates).forEach(([key, value]) => {
      this._state[key as keyof TState] = value
      this.eventBus.emit(key as keyof TState, value)
    })
  }

  // Message handling interface - implemented by concrete services
  abstract handle<K extends keyof Messages>(
    message: Message<Messages, K>
  ): Promise<void> | void

  // Send message to this service
  async send<K extends keyof Messages>(
    type: K,
    payload: Messages[K],
    correlationId?: string
  ): Promise<void> {
    // handle method is abstract, so it's always implemented

    const message = createMessage<Messages, K>(type, payload, correlationId)
    
    // Store in history for debugging
    this.messageHistory.push(message as Message<Messages>)
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${this.constructor.name}] Handling message:`, message)
    }
    
    try {
      await this.handle(message)
    } catch (error) {
      console.error(`[${this.constructor.name}] Message handling error:`, error)
      throw error
    }
  }

  // Request/response pattern
  async request<
    ReqKey extends keyof Messages,
    ResKey extends keyof Messages
  >(
    requestType: ReqKey,
    payload: Messages[ReqKey],
    responseType: ResKey,
    timeout = 5000
  ): Promise<Messages[ResKey]> {
    const correlationId = generateMessageId()
    
    return new Promise<Messages[ResKey]>((resolve, reject) => {
      // Set up response listener
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(correlationId)
        reject(new Error(`Request timeout: ${String(requestType)}`))
      }, timeout)
      
      this.pendingRequests.set(correlationId, {
        resolve,
        reject,
        responseType,
        timeout: timeoutHandle
      })
      
      // Send the request
      this.send(requestType, payload, correlationId).catch(reject)
    })
  }

  // Handle response messages for pending requests
  protected resolveRequest<K extends keyof Messages>(
    type: K,
    payload: Messages[K],
    correlationId: string
  ): void {
    const pending = this.pendingRequests.get(correlationId)
    if (pending && pending.responseType === type) {
      clearTimeout(pending.timeout)
      this.pendingRequests.delete(correlationId)
      pending.resolve(payload)
    }
  }

  // Get message history for debugging
  getMessageHistory(): Message<Messages>[] {
    return [...this.messageHistory]
  }

  // Clear message history
  clearMessageHistory(): void {
    this.messageHistory = []
  }

  // Replay messages from history
  async replayMessages(fromIndex = 0): Promise<void> {
    const messages = this.messageHistory.slice(fromIndex)
    for (const message of messages) {
      await this.handle(message as any)
    }
  }
  
  /**
   * Clear state and events for testing
   */
  public clear(): void {
    this.eventBus.clear()
    
    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Service disposed'))
    }
    this.pendingRequests.clear()
    this.messageHistory = []
  }
}