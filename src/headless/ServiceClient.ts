import { TypedServiceToken, StateFromToken } from '../core/ServiceTokens'
import { ServiceContainer } from '../core/ServiceContainer'
import { EventSubscription } from '../types'

/**
 * Headless client for interacting with services outside of UI components
 * Provides the same functionality as UI hooks but for non-reactive contexts
 */
export class ServiceClient<T extends TypedServiceToken> {
  private service: any
  private subscriptions = new Set<EventSubscription>()
  
  /**
   * Strongly typed reactive state proxy
   * Access state properties directly: client.state.count
   */
  public readonly state: StateFromToken<T>

  constructor(
    container: ServiceContainer,
    serviceToken: T
  ) {
    this.service = container.resolve(serviceToken)
    
    // Create strongly typed state proxy that mirrors the service state
    this.state = new Proxy({} as StateFromToken<T>, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'string') {
          return this.service.state[prop]
        }
        return target[prop as keyof StateFromToken<T>]
      },
      set: () => {
        throw new Error('Cannot directly modify service state from client. Use actions instead.')
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
   * Send a message to the service (only works with MessageService + @withMessages)
   */
  async send(messageType: string, payload?: any): Promise<void> {
    if (typeof this.service.send === 'function') {
      return this.service.send(messageType, payload || {})
    }
    throw new Error(
      `Service ${this.service.constructor.name} does not support message sending. ` +
      `Make sure it extends MessageService and uses @withMessages decorator.`
    )
  }

  /**
   * Get actions object (same as createServiceActions but for headless use)
   */
  getActions(): any {
    const actions = {} as any
    
    // Check if service has decorator metadata
    const messageTypes = this.service.__messageTypes
    const actionCreators = this.service.__actionCreators
    
    if (messageTypes && Array.isArray(messageTypes)) {
      messageTypes.forEach((type: string) => {
        const methodName = this.toCamelCase(type)
        const customAction = actionCreators?.[type]
        
        if (customAction) {
          actions[methodName] = async (...args: any[]) => {
            const payload = customAction(...args)
            return this.service.send(type, payload)
          }
        } else {
          actions[methodName] = async (payload?: any) => {
            return this.service.send(type, payload || {})
          }
        }
      })
    } else {
      throw new Error(
        `Service ${this.service.constructor.name} does not use @withMessages decorator. ` +
        `For pure message-passing architecture, all services should extend MessageService.`
      )
    }
    
    return actions
  }

  /**
   * Clean up all subscriptions
   */
  dispose(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe())
    this.subscriptions.clear()
  }

  private toCamelCase(str: string): string {
    return str.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
  }
}

/**
 * Factory function to create a service client
 */
export function createServiceClient<T extends TypedServiceToken>(
  container: ServiceContainer,
  serviceToken: T
): ServiceClient<T> {
  return new ServiceClient(container, serviceToken)
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