import { TypedServiceToken, StateFromToken } from '../core/ServiceTokens'
import { ServiceContainer } from '../core/ServiceContainer'
import { EventSubscription } from '../types'

// Import the same ExtractActions type used by UI packages
import { ExtractActions } from '../core/TypeExtraction'

/**
 * Headless client for interacting with services outside of UI components
 * Provides the exact same API as UI hooks but for non-reactive contexts
 */
export class ServiceClient<T extends TypedServiceToken> {
  private service: any
  private subscriptions = new Set<EventSubscription>()

  /**
   * Strongly typed state proxy with destructuring support
   * Access state properties directly: client.state.count
   * Or destructure: const { count, name } = client.state
   */
  public readonly state: StateFromToken<T>

  /**
   * Strongly typed action proxy
   * Access actions directly: client.actions.increment()
   * Or destructure: const { increment, decrement } = client.actions
   */
  public readonly actions: {
    [K in keyof ExtractActions<T>]: (...args: ExtractActions<T>[K]) => Promise<void>
  }

  constructor(
    container: ServiceContainer,
    serviceToken: T
  ) {
    this.service = container.resolve(serviceToken)

    // Create state proxy with destructuring support (same as UI packages)
    this.state = new Proxy({} as StateFromToken<T>, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'string') {
          return this.service.state[prop]
        }
        return target[prop as keyof StateFromToken<T>]
      },

      set: () => {
        throw new Error('Cannot directly modify service state from client. Use actions instead.')
      },

      // Support for Object.keys(), Object.entries(), etc. and destructuring
      ownKeys: () => {
        return Object.keys(this.service.getState())
      },

      getOwnPropertyDescriptor: (_, prop) => {
        if (typeof prop === 'string' && this.service.getState().hasOwnProperty(prop)) {
          return {
            enumerable: true,
            configurable: true,
            value: this.service.state[prop]
          }
        }
        return undefined
      },

      has: (_, prop) => {
        return typeof prop === 'string' && this.service.getState().hasOwnProperty(prop)
      }
    })

    // Create actions proxy (same approach as UI packages)
    this.actions = this.createActionsProxy()
  }

  /**
   * Create actions proxy using the same approach as UI packages
   */
  private createActionsProxy() {
    // List of Service base methods that should not be exposed as actions
    const baseServiceMethods = new Set([
      'send', 'request', 'on', 'off', 'once', 'removeAllListeners',
      'hasListeners', 'getListenerCount', 'getState', 'clear',
      'getMessageHistory', 'clearMessageHistory', 'replayMessages', 'resolveRequest'
    ])

    return new Proxy({} as any, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'string') {
          // Check if this is a valid action method
          const method = this.service[prop]
          if (typeof method === 'function' && !baseServiceMethods.has(prop)) {
            // Return a function that sends the message to the service
            return async (...args: any[]) => {
              return this.service.send(prop, args)
            }
          }
        }
        return target[prop]
      },

      // Support for Object.keys(), Object.entries(), etc. and destructuring
      ownKeys: () => {
        // Get all methods that are actions (not base service methods)
        const servicePrototype = Object.getPrototypeOf(this.service)
        return Object.getOwnPropertyNames(servicePrototype)
          .filter(name => typeof this.service[name] === 'function')
          .filter(name => !name.startsWith('_') && name !== 'constructor')
          .filter(name => !baseServiceMethods.has(name))
      },

      getOwnPropertyDescriptor: (_, prop) => {
        if (typeof prop === 'string') {
          const method = this.service[prop]
          if (typeof method === 'function' && !baseServiceMethods.has(prop)) {
            return {
              enumerable: true,
              configurable: true,
              value: async (...args: any[]) => this.service.send(prop, args)
            }
          }
        }
        return undefined
      },

      has: (_, prop) => {
        if (typeof prop === 'string') {
          const method = this.service[prop]
          return typeof method === 'function' && !baseServiceMethods.has(prop)
        }
        return false
      }
    })
  }


  /**
   * Get a snapshot of all current state (preferred over getAllState)
   */
  snapshot(): StateFromToken<T> {
    return this.service.getState()
  }

  /**
   * Subscribe to state changes for a specific property
   */
  subscribe<K extends keyof StateFromToken<T>>(
    key: K, 
    callback: (value: StateFromToken<T>[K]) => void
  ): EventSubscription {
    const subscription = this.service.on(key as string, callback)
    this.subscriptions.add(subscription)
    return subscription
  }

  /**
   * Subscribe to all state changes
   */
  subscribeToAll(callback: (state: StateFromToken<T>) => void): EventSubscription {
    // Subscribe to all current state keys
    const currentState = this.snapshot()
    const subscriptions: EventSubscription[] = []
    
    Object.keys(currentState).forEach(key => {
      const sub = this.service.on(key, () => {
        callback(this.snapshot())
      })
      subscriptions.push(sub)
    })

    // Return a composite subscription
    const compositeSubscription: EventSubscription = {
      unsubscribe: () => {
        subscriptions.forEach(sub => sub.unsubscribe())
        this.subscriptions.delete(compositeSubscription)
      }
    }
    
    this.subscriptions.add(compositeSubscription)
    return compositeSubscription
  }



  /**
   * Clean up all subscriptions
   */
  dispose(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe())
    this.subscriptions.clear()
  }

}

/**
 * Factory function to create a service client with the same API as UI packages
 *
 * @example
 * ```typescript
 * const client = createServiceClient(container, TodoToken)
 *
 * // State access (with destructuring support)
 * console.log(client.state.items) // Direct access
 * const { items, filter, loading } = client.state // Destructuring
 *
 * // Actions (with destructuring support)
 * await client.actions.addItem('New todo') // Direct access
 * const { addItem, removeItem } = client.actions // Destructuring
 * await addItem('New todo')
 * ```
 */
export function createServiceClient<T extends TypedServiceToken>(
  container: ServiceContainer,
  serviceToken: T
): ServiceClient<T> {
  return new ServiceClient(container, serviceToken)
}

/**
 * Convenience function that returns state and actions separately (similar to UI hooks)
 *
 * @example
 * ```typescript
 * const { state, actions } = useService(container, TodoToken)
 *
 * // Same API as React/SolidJS
 * const { items, filter } = state
 * const { addItem, removeItem } = actions
 * ```
 */
export function useService<T extends TypedServiceToken>(
  container: ServiceContainer,
  serviceToken: T
) {
  const client = new ServiceClient(container, serviceToken)
  return {
    state: client.state,
    actions: client.actions,
    // Include utility methods for convenience
    subscribe: client.subscribe.bind(client),
    subscribeToAll: client.subscribeToAll.bind(client),
    snapshot: client.snapshot.bind(client),
    dispose: client.dispose.bind(client)
  }
}

/**
 * Simple state observer for one-off state monitoring
 */
export class ServiceStateObserver<T extends TypedServiceToken> {
  constructor(
    private container: ServiceContainer,
    private serviceToken: T
  ) {}

  /**
   * Wait for a specific state condition to be true
   */
  async waitFor<K extends keyof StateFromToken<T>>(
    key: K,
    predicate: (value: StateFromToken<T>[K]) => boolean,
    timeout?: number
  ): Promise<StateFromToken<T>[K]> {
    const service = this.container.resolve(this.serviceToken)
    const currentValue = service.state[key as string]
    
    // Check if condition is already met
    if (predicate(currentValue)) {
      return currentValue
    }

    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined
      
      if (timeout) {
        timeoutId = setTimeout(() => {
          subscription.unsubscribe()
          reject(new Error(`Timeout waiting for condition on ${String(key)}`))
        }, timeout)
      }

      const subscription = service.on(key as string, (value: StateFromToken<T>[K]) => {
        if (predicate(value)) {
          subscription.unsubscribe()
          if (timeoutId) clearTimeout(timeoutId)
          resolve(value)
        }
      })
    })
  }

  /**
   * Get a one-time snapshot of current state
   */
  snapshot(): StateFromToken<T> {
    const service = this.container.resolve(this.serviceToken)
    return service.getState() as StateFromToken<T>
  }
}