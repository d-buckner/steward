import { ServiceEventBus } from './ServiceEventBus'
import { EventBus, EventHandler, EventSubscription } from '../types'
import { generateMessageId } from './Messages'
import { getWorkerOptions } from './WorkerDecorator'

/**
 * Client for communicating with worker services following the mailbox pattern.
 * This provides the same interface as a Service but forwards calls to the worker.
 */
export class WorkerServiceClient implements EventBus {
  private eventBus = new ServiceEventBus()
  private worker!: Worker
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }>()
  private _state: Record<string, any> = {}

  public readonly state: Record<string, any>

  constructor(
    private ServiceConstructor: any,
    initialState: Record<string, any>
  ) {
    this._state = { ...initialState }

    // Create reactive state proxy
    this.state = new Proxy(this._state, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'string') {
          return this.eventBus.get(prop)
        }
        return (target as any)[prop]
      },
      set: () => {
        throw new Error('Cannot directly modify service state. Worker manages state.')
      }
    })

    // Set up worker
    this.setupWorker()

    // Return a Proxy that intercepts method calls and forwards them to worker
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (typeof prop === 'string') {
          // Handle state property access
          if (prop === 'state') {
            return target.state
          }

          // Handle EventBus methods (on, off, once, etc.)
          if (prop === 'on' || prop === 'off' || prop === 'once' || prop === 'removeAllListeners' ||
              prop === 'hasListeners' || prop === 'getListenerCount' || prop === 'getState' || prop === 'clear') {
            return target[prop].bind(target)
          }

          // Handle service methods by checking if they exist on the service constructor prototype
          if (target.isServiceMethod(prop)) {
            return (...args: any[]) => target.callWorkerMethod(prop, args)
          }
        }

        // Fallback to original property
        return Reflect.get(target, prop, receiver)
      }
    }) as any
  }

  private setupWorker(): void {
    const workerOptions = getWorkerOptions(this.ServiceConstructor)
    const workerName = workerOptions.name

    if (!workerName) {
      throw new Error(`Service '${this.ServiceConstructor.name}' is decorated with @withWorker but missing worker name`)
    }

    // Derive worker URL from decorator name
    const workerUrl = `/dist/workers/${workerName}.worker.js`

    // Create worker
    this.worker = new Worker(workerUrl, { type: 'module' })

    // Set up worker communication
    this.worker.onmessage = this.handleWorkerMessage.bind(this)
    this.worker.onerror = this.handleWorkerError.bind(this)

    // Initialize service in worker
    this.worker.postMessage({
      type: 'INIT_SERVICE',
      serviceName: this.ServiceConstructor.name,
      initialState: this._state
    })

    // Emit initial state to eventBus
    Object.entries(this._state).forEach(([key, value]) => {
      this.eventBus.emit(key, value)
    })
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const { type, id, key, value, result, error } = event.data

    switch (type) {
      case 'STATE_CHANGE':
        // Update local state and emit to eventBus
        this._state[key] = value
        this.eventBus.emit(key, value)
        break

      case 'MESSAGE_RESPONSE':
        // Handle method response
        if (id && this.pendingRequests.has(id)) {
          const pending = this.pendingRequests.get(id)!
          clearTimeout(pending.timeout)
          this.pendingRequests.delete(id)

          if (error) {
            pending.reject(new Error(error))
          } else {
            pending.resolve(result)
          }
        }
        break

      case 'INIT_SERVICE':
        if (!event.data.success) {
          console.error('Worker service initialization failed:', event.data.error)
        }
        break
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('[WorkerServiceClient] Worker error:', error)
  }

  // EventBus interface implementation
  on<T = any>(event: string, handler: EventHandler<T>): EventSubscription {
    return this.eventBus.on(event, handler)
  }

  off<T = any>(event: string, handler: EventHandler<T>): void {
    this.eventBus.off(event, handler)
  }

  once<T = any>(event: string, handler: EventHandler<T>): EventSubscription {
    return this.eventBus.once(event, handler)
  }

  removeAllListeners(event?: string): void {
    this.eventBus.removeAllListeners(event)
  }

  hasListeners(event: string): boolean {
    return this.eventBus.hasListeners(event)
  }

  getListenerCount(event: string): number {
    return this.eventBus.getListenerCount(event)
  }

  // Service-like interface for method calls
  send(type: string, payload: any[], correlationId?: string): void {
    const id = correlationId || generateMessageId()

    this.worker.postMessage({
      type: 'SERVICE_MESSAGE',
      id,
      messageType: type,
      payload: Array.isArray(payload) ? payload : [payload]
    })
  }

  async request(
    requestType: string,
    payload: any[],
    timeout = 5000
  ): Promise<any> {
    const id = generateMessageId()

    return new Promise<any>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request timeout: ${requestType}`))
      }, timeout)

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout: timeoutHandle
      })

      // Send the request
      this.worker.postMessage({
        type: 'SERVICE_MESSAGE',
        id,
        messageType: requestType,
        payload: Array.isArray(payload) ? payload : [payload]
      })
    })
  }

  getState(): Record<string, any> {
    return this.eventBus.getState()
  }

  clear(): void {
    this.eventBus.clear()

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Client disposed'))
    }
    this.pendingRequests.clear()

    // Terminate worker
    if (this.worker) {
      this.worker.terminate()
    }
  }

  /**
   * Check if a property is a service method that should be forwarded to worker
   */
  private isServiceMethod(prop: string): boolean {
    let currentPrototype = this.ServiceConstructor.prototype

    // Check if it's a method on the service prototype
    while (currentPrototype && currentPrototype !== Object.prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(currentPrototype, prop)
      if (descriptor && typeof descriptor.value === 'function' && prop !== 'constructor') {
        // Exclude base Service class methods that shouldn't be exposed
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
    const baseServiceMethods = [
      'setState', 'setStates', 'emit', 'on', 'off', 'once', 'clear', 'send', 'request',
      'getState', 'getMessageHistory', 'clearMessageHistory', 'replayMessages'
    ]
    return baseServiceMethods.includes(prop)
  }

  /**
   * Call a method on the worker service
   */
  private async callWorkerMethod(methodName: string, args: any[]): Promise<any> {
    return this.request(methodName, args)
  }
}