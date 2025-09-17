import { ServiceEventBus } from './ServiceEventBus'
import { EventBus, EventHandler, EventSubscription } from '../types'

/**
 * Base class for all services with reactive state management
 * Implements EventBus interface directly for clean API
 */
export abstract class Service<TState extends Record<string, any> = Record<string, any>> implements EventBus {
  private eventBus = new ServiceEventBus<TState>()
  private _state: TState
  
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
  
  getCurrentState(): Record<string, any> {
    return this.eventBus.getCurrentState()
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
  
  /**
   * Clear state and events for testing
   */
  public clear(): void {
    this.eventBus.clear()
  }
}