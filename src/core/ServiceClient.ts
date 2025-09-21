import { ServiceEventBus } from './ServiceEventBus'
import { Service } from './Service'
import { TypedServiceToken } from './ServiceTokens'

/**
 * ServiceClient is a transparent proxy that perfectly mimics a service interface
 * while ensuring all communication goes through the mailbox pattern.
 *
 * Consumers never know they're using a client - it looks and feels exactly like the service.
 * The framework secretly routes all calls through message passing for location transparency.
 */
export class ServiceClient<T extends Service> {
  private eventBus = new ServiceEventBus()
  private subscriptions = new Map<string, Set<Function>>()
  private cachedState: Partial<T['state']> = {}

  constructor(
    private token: TypedServiceToken<T>,
    private getServiceInstance: () => T,
    private workerId?: string
  ) {
    this.setupEventForwarding()

    // Return a Proxy that intercepts all property access
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (typeof prop === 'string') {
          // Handle state property access
          if (prop === 'state') {
            return target.createStateProxy()
          }

          // Handle EventBus methods (on, off, once, emit)
          if (prop === 'on' || prop === 'off' || prop === 'once' || prop === 'emit') {
            return target[prop].bind(target)
          }

          // Handle getState method specifically for hooks
          if (prop === 'getState') {
            return () => target.getServiceInstance().getState()
          }

          // Handle service methods
          if (target.isServiceMethod(prop)) {
            return (...args: any[]) => target.callMethod(prop, args)
          }

          // Handle other service properties
          if (prop in target.getServiceInstance()) {
            const value = (target.getServiceInstance() as any)[prop]
            if (typeof value !== 'function') {
              return value
            }
          }
        }

        // Fallback to original property
        return Reflect.get(target, prop, receiver)
      }
    }) as any
  }

  /**
   * Create a reactive state proxy that looks like direct property access
   */
  private createStateProxy(): T['state'] {
    return new Proxy({} as T['state'], {
      get: (_, prop) => {
        if (typeof prop === 'string') {
          return this.getCurrentStateValue(prop as keyof T['state'])
        }
        return undefined
      },

      ownKeys: () => {
        const service = this.getServiceInstance()
        return Object.keys((service as any)._state || {})
      },

      getOwnPropertyDescriptor: (_, prop) => {
        if (typeof prop === 'string') {
          const service = this.getServiceInstance()
          const state = (service as any)._state || {}
          if (prop in state) {
            return {
              enumerable: true,
              configurable: true,
              value: this.getCurrentStateValue(prop as keyof T['state'])
            }
          }
        }
        return undefined
      },

      has: (_, prop) => {
        if (typeof prop === 'string') {
          const service = this.getServiceInstance()
          const state = (service as any)._state || {}
          return prop in state
        }
        return false
      }
    })
  }

  /**
   * EventBus implementation - these methods are exposed directly on the service interface
   */
  on<K extends keyof T['state']>(key: K, callback: (value: T['state'][K]) => void): { unsubscribe: () => void } {
    this.eventBus.on(key as string, callback)
    this.trackSubscription(key as string, callback)

    return {
      unsubscribe: () => {
        this.eventBus.off(key as string, callback)
        this.untrackSubscription(key as string, callback)
      }
    }
  }

  off<K extends keyof T['state']>(key: K, callback?: (value: T['state'][K]) => void): void {
    this.eventBus.off(key as string, callback as any)
    this.untrackSubscription(key as string, callback)
  }

  once<K extends keyof T['state']>(key: K, callback: (value: T['state'][K]) => void): void {
    const wrappedCallback = (value: T['state'][K]) => {
      callback(value)
      this.untrackSubscription(key as string, wrappedCallback)
    }
    this.eventBus.once(key as string, wrappedCallback)
    this.trackSubscription(key as string, wrappedCallback)
  }

  emit<K extends keyof T['state']>(key: K, value: T['state'][K]): void {
    this.eventBus.emit(key as string, value)
    // Update cached state
    this.cachedState[key] = value
  }

  /**
   * Get current value of a state property
   */
  private getCurrentStateValue<K extends keyof T['state']>(key: K): T['state'][K] {
    if (this.workerId) {
      // For worker services, return cached value and request update if needed
      return this.getWorkerStateValue(key)
    } else {
      // For local services, get current value from service instance
      return this.getLocalStateValue(key)
    }
  }

  /**
   * Call a method on the service (looks like direct method call to consumer)
   */
  private async callMethod(methodName: string, args: any[]): Promise<any> {
    if (this.workerId) {
      return this.callWorkerMethod(methodName, args)
    } else {
      return this.callLocalMethod(methodName, args)
    }
  }

  /**
   * Setup event forwarding from service to client event bus
   */
  private setupEventForwarding(): void {
    if (this.workerId) {
      this.setupWorkerEventForwarding()
    } else {
      this.setupLocalEventForwarding()
    }
  }

  /**
   * Forward events from local service to client event bus
   */
  private setupLocalEventForwarding(): void {
    const service = this.getServiceInstance()

    // Forward all state change events by monkey-patching eventBus.emit
    const originalEmit = (service as any).eventBus?.emit?.bind((service as any).eventBus)
    if (originalEmit) {
      (service as any).eventBus.emit = (key: any, value: any) => {
        originalEmit(key, value)
        this.emit(key, value)
      }
    }
  }

  /**
   * Forward events from worker service to client event bus
   */
  private setupWorkerEventForwarding(): void {
    if (!this.workerId) return

    // Listen for worker messages and forward to local event bus
    const handleWorkerMessage = (event: MessageEvent) => {
      const { type, serviceToken, key, value } = event.data

      if (type === 'STATE_CHANGE' && serviceToken === this.token.id) {
        this.emit(key, value)
      }
    }

    // Get worker and subscribe to messages
    this.getWorker()?.addEventListener('message', handleWorkerMessage)
  }

  /**
   * Get state value from local service
   */
  private getLocalStateValue<K extends keyof T['state']>(key: K): T['state'][K] {
    const service = this.getServiceInstance()
    return (service.state as any)[key]
  }

  /**
   * Get state value from worker service (cached)
   */
  private getWorkerStateValue<K extends keyof T['state']>(key: K): T['state'][K] {
    // Return cached value or undefined if not yet received
    return this.cachedState[key] as T['state'][K]
  }

  /**
   * Call method on local service
   */
  private async callLocalMethod(methodName: string, args: any[]): Promise<any> {
    const service = this.getServiceInstance()

    // Use mailbox pattern - send message instead of direct method call
    return service.send(methodName, args)
  }

  /**
   * Call method on worker service
   */
  private async callWorkerMethod(methodName: string, args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substring(7)
      const worker = this.getWorker()

      if (!worker) {
        reject(new Error(`Worker not found for service ${this.token.id}`))
        return
      }

      // Listen for response
      const handleResponse = (event: MessageEvent) => {
        const { type, requestId: responseId, result, error } = event.data

        if (type === 'METHOD_RESPONSE' && responseId === requestId) {
          worker.removeEventListener('message', handleResponse)

          if (error) {
            reject(new Error(error))
          } else {
            resolve(result)
          }
        }
      }

      worker.addEventListener('message', handleResponse)

      // Send method call request
      worker.postMessage({
        type: 'METHOD_CALL',
        serviceToken: this.token.id,
        method: methodName,
        args,
        requestId
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        worker.removeEventListener('message', handleResponse)
        reject(new Error(`Method call timeout: ${methodName}`))
      }, 5000)
    })
  }

  /**
   * Get worker instance from service
   */
  private getWorker(): Worker | undefined {
    if (!this.workerId) return undefined

    const service = this.getServiceInstance()
    return (service as any).getWorker?.()
  }

  /**
   * Check if a property is a service method
   */
  private isServiceMethod(prop: string): boolean {
    const service = this.getServiceInstance()
    let currentPrototype = Object.getPrototypeOf(service)

    // Check if it's a method on the service prototype
    while (currentPrototype && currentPrototype !== Object.prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(currentPrototype, prop)
      if (descriptor && typeof descriptor.value === 'function' && prop !== 'constructor') {
        // Exclude Service base class methods that shouldn't be exposed
        if (!this.isBaseServiceMethod(prop)) {
          return true
        }
      }
      currentPrototype = Object.getPrototypeOf(currentPrototype)
    }

    return false
  }

  /**
   * Check if method is from base Service class (shouldn't be exposed to consumers)
   */
  private isBaseServiceMethod(prop: string): boolean {
    return Service.BASE_METHODS.has(prop)
  }

  /**
   * Track subscription for cleanup
   */
  private trackSubscription(key: string, callback: Function): void {
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set())
    }
    this.subscriptions.get(key)!.add(callback)
  }

  /**
   * Remove subscription tracking
   */
  private untrackSubscription(key: string, callback?: Function): void {
    if (!this.subscriptions.has(key)) return

    if (callback) {
      this.subscriptions.get(key)!.delete(callback)
    } else {
      this.subscriptions.get(key)!.clear()
    }
  }

  /**
   * Clean up all subscriptions
   */
  dispose(): void {
    this.subscriptions.clear()
    // Remove event forwarding
    // TODO: Clean up worker event listeners
  }
}