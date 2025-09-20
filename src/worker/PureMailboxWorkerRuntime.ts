/**
 * Pure Mailbox Worker Runtime
 *
 * A simplified worker runtime that:
 * - Uses pure message passing (no method dispatch)
 * - Has event-sourced state synchronization
 * - Eliminates complex service discovery
 * - Follows true mailbox architecture principles
 * - Has predictable error handling
 */

// Worker context types
declare const self: Worker & typeof globalThis

interface WorkerMessage {
  type: 'REGISTER_SERVICE' | 'INIT_SERVICE' | 'MESSAGE' | 'STATE_CHANGE' | 'ERROR'
  serviceName?: string
  initialState?: any
  messageType?: string
  payload?: any
  key?: string
  value?: any
  error?: string
  id?: string
}

interface MessageResponse {
  success: boolean
  result?: any
  error?: string
}

/**
 * Pure Mailbox Worker Runtime Implementation
 */
class PureMailboxWorkerRuntimeImpl {
  private services = new Map<string, new (...args: any[]) => any>()
  private currentService: any = null
  private stateChangeListeners: Array<(key: string, value: any) => void> = []

  /**
   * Register a service class in the worker
   */
  registerService(name: string, serviceClass: new (...args: any[]) => any): void {
    this.services.set(name, serviceClass)
  }

  /**
   * Initialize a service instance
   */
  async initializeService(serviceName: string, initialState: any): Promise<MessageResponse> {
    try {
      const ServiceClass = this.services.get(serviceName)
      if (!ServiceClass) {
        return { success: false, error: `Service ${serviceName} not registered` }
      }

      this.currentService = new ServiceClass(initialState)

      // Override service's setState to emit state changes
      const originalSetState = this.currentService.setState?.bind(this.currentService)
      if (originalSetState) {
        this.currentService.setState = (key: string, value: any) => {
          originalSetState(key, value)
          this.emitStateChange(key, value)
        }
      }

      // Override service's setStates to emit multiple state changes
      const originalSetStates = this.currentService.setStates?.bind(this.currentService)
      if (originalSetStates) {
        this.currentService.setStates = (updates: Record<string, any>) => {
          originalSetStates(updates)
          Object.entries(updates).forEach(([key, value]) => {
            this.emitStateChange(key, value)
          })
        }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Handle incoming messages using pure mailbox pattern
   */
  async handleMessage(messageType: string, payload: any): Promise<MessageResponse> {
    try {
      if (!this.currentService) {
        return { success: false, error: 'No service initialized' }
      }

      // Pure mailbox routing - map message types to handler methods
      const handlerName = `handle${messageType.charAt(0).toUpperCase() + messageType.slice(1)}`
      const handler = this.currentService[handlerName]

      if (typeof handler !== 'function') {
        return { success: false, error: `No handler for message type: ${messageType}` }
      }

      // Call handler with payload
      const result = Array.isArray(payload)
        ? await handler.apply(this.currentService, payload)
        : await handler.call(this.currentService, payload)

      return { success: true, result }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Emit state changes to listeners
   */
  private emitStateChange(key: string, value: any): void {
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(key, value)
      } catch (error) {
        console.error('State change listener error:', error)
      }
    })
  }

  /**
   * Add state change listener
   */
  onStateChange(listener: (key: string, value: any) => void): void {
    this.stateChangeListeners.push(listener)
  }

  /**
   * Get current service state
   */
  getServiceState(): any {
    return this.currentService?.getState() || {}
  }

  /**
   * Clear everything for cleanup
   */
  clear(): void {
    this.currentService?.clear()
    this.services.clear()
    this.stateChangeListeners.length = 0
    this.currentService = null
  }

  /**
   * Initialize worker runtime only if we're actually in a worker context
   */
  initializeWorkerContext(): void {
    // Only run worker code if we're in an actual worker context
    if (typeof self !== 'undefined' && typeof importScripts === 'function') {
      this.setupWorkerMessageHandling()
    }
  }

  /**
   * Set up worker message handling
   */
  private setupWorkerMessageHandling(): void {
    // Set up state change forwarding to main thread
    this.onStateChange((key: string, value: any) => {
      self.postMessage({
        type: 'STATE_CHANGE',
        key,
        value
      })
    })

    /**
     * Main message handler for worker
     */
    self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
      const { type, serviceName, initialState, messageType, payload, id } = event.data

      try {
        switch (type) {
          case 'INIT_SERVICE':
            if (serviceName && initialState !== undefined) {
              const result = await this.initializeService(serviceName, initialState)
              self.postMessage({
                type: 'INIT_SERVICE',
                ...result
              })
            }
            break

          case 'SERVICE_MESSAGE':
            if (messageType) {
              const result = await this.handleMessage(messageType, payload)
              self.postMessage({
                type: 'MESSAGE_RESPONSE',
                id,
                ...result
              })
            }
            break

          default:
            console.warn('Unknown message type in worker:', type)
        }
      } catch (error) {
        console.error('Worker message handling error:', error)
        self.postMessage({
          type: 'ERROR',
          error: (error as Error).message
        })
      }
    }

    /**
     * Handle worker errors
     */
    self.onerror = (error) => {
      console.error('Worker runtime error:', error)
      self.postMessage({
        type: 'ERROR',
        error: typeof error === 'string' ? error : (error as any)?.message || String(error)
      })
    }

    /**
     * Handle unhandled promise rejections
     */
    self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      console.error('Worker unhandled promise rejection:', event.reason)
      self.postMessage({
        type: 'ERROR',
        error: event.reason?.message || String(event.reason)
      })
    })
  }
}

/**
 * Global singleton instance
 */
export const PureMailboxWorkerRuntime = new PureMailboxWorkerRuntimeImpl()

/**
 * Register a service class in the worker runtime
 */
export function registerPureMailboxService(name: string, serviceClass: new (...args: any[]) => any): void {
  PureMailboxWorkerRuntime.registerService(name, serviceClass)
}

/**
 * Initialize the worker runtime
 * Call this at the end of your worker entry file
 */
export function initializePureMailboxWorker(): void {
  PureMailboxWorkerRuntime.initializeWorkerContext()
}

// Auto-initialize if we're in a worker context
if (typeof self !== 'undefined' && typeof importScripts === 'function') {
  PureMailboxWorkerRuntime.initializeWorkerContext()
}