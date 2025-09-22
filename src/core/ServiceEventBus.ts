export type EventHandler<T = any> = (data: T) => void

export interface EventSubscription {
  unsubscribe(): void
}

/**
 * Type-safe event bus for service state management
 */
export class ServiceEventBus<TEvents extends Record<string, any>> {
  private listeners = new Map<keyof TEvents, Set<EventHandler<TEvents[keyof TEvents]>>>();
  private currentState = new Map<keyof TEvents, unknown>();
  
  /**
   * Emit an event with data and update current state
   */
  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void {
    this.currentState.set(event, data);
    this.listeners.get(event)?.forEach(listener => listener(data));
  }
  
  /**
   * Subscribe to an event
   */
  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): EventSubscription {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(handler as EventHandler<TEvents[keyof TEvents]>);
    
    return {
      unsubscribe: () => this.off(event, handler)
    };
  }
  
  /**
   * Unsubscribe from an event
   */
  off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
    this.listeners.get(event)?.delete(handler as EventHandler<TEvents[keyof TEvents]>);
  }
  
  /**
   * Subscribe to an event for one-time execution
   */
  once<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): EventSubscription {
    const onceHandler = (data: TEvents[K]) => {
      handler(data);
      this.off(event, onceHandler);
    };
    
    return this.on(event, onceHandler);
  }
  
  /**
   * Get the current value for an event (state key)
   */
  get<K extends keyof TEvents>(event: K): TEvents[K] | undefined {
    return this.currentState.get(event) as TEvents[K] | undefined;
  }
  
  /**
   * Get all current state
   */
  getState(): Partial<TEvents> {
    const state = {} as Partial<TEvents>;
    this.currentState.forEach((value, key) => {
      state[key] = value as TEvents[keyof TEvents];
    });
    return state;
  }
  
  /**
   * Remove all listeners for a specific event or all events
   */
  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
  
  /**
   * Check if there are listeners for an event
   */
  hasListeners(event: keyof TEvents): boolean {
    return (this.listeners.get(event)?.size ?? 0) > 0;
  }
  
  /**
   * Get the number of listeners for an event
   */
  getListenerCount(event: keyof TEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }
  
  /**
   * Clear all state and listeners (for testing)
   */
  clear(): void {
    this.listeners.clear();
    this.currentState.clear();
  }
}
