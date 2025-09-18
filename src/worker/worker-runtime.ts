/**
 * Worker runtime that executes Steward services in a Web Worker context
 * This file runs inside the worker and handles service instantiation and message routing
 */

// Import necessary types and utilities for worker context
declare const self: Worker & typeof globalThis

interface WorkerMessage {
  type: 'INIT_SERVICE' | 'SERVICE_MESSAGE'
  id?: string
  serviceCode?: string
  serviceName?: string
  initialState?: any
  messageTypes?: string[]
  actionCreators?: Record<string, Function>
  messageType?: string
  payload?: any
}

// Global service instance running in this worker
let serviceInstance: any = null

// Service registry for worker
const serviceRegistry = new Map<string, new (...args: any[]) => any>()

/**
 * Register a service class in the worker runtime
 * This avoids the need for eval by pre-registering service constructors
 */
export function registerWorkerService(name: string, serviceClass: new (...args: any[]) => any): void {
  serviceRegistry.set(name, serviceClass)
}

/**
 * Initialize a service instance in the worker context
 */
async function initializeService(data: WorkerMessage): Promise<void> {
  try {
    const { serviceName, messageTypes, actionCreators } = data

    if (!serviceName) {
      throw new Error('Service name is required for worker initialization')
    }

    // Get service class from registry instead of using eval
    const ServiceClass = serviceRegistry.get(serviceName)
    if (!ServiceClass) {
      throw new Error(`Service '${serviceName}' not registered in worker. Use registerWorkerService() to register it.`)
    }

    // Restore decorator metadata
    if (messageTypes) {
      (ServiceClass as any).__messageTypes = messageTypes
    }
    if (actionCreators) {
      (ServiceClass as any).__actionCreators = actionCreators
    }

    // Create service instance
    serviceInstance = new ServiceClass()

    // Set up event forwarding to main thread
    setupEventForwarding()

    // Notify main thread of successful initialization
    self.postMessage({
      type: 'INIT_SERVICE',
      success: true
    })

  } catch (error) {
    console.error('Worker service initialization failed:', error)
    self.postMessage({
      type: 'INIT_SERVICE',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Set up event forwarding from service to main thread
 */
function setupEventForwarding(): void {
  if (!serviceInstance) return

  // Forward state changes to main thread
  const originalSetState = serviceInstance.setState?.bind(serviceInstance)
  if (originalSetState) {
    serviceInstance.setState = function(key: string, value: any) {
      // Call original setState
      originalSetState(key, value)
      
      // Forward state change to main thread
      self.postMessage({
        type: 'STATE_CHANGE',
        key,
        value
      })
    }
  }

  // Forward events to main thread
  const originalEmit = serviceInstance.eventBus?.emit?.bind(serviceInstance.eventBus)
  if (originalEmit) {
    serviceInstance.eventBus.emit = function(event: string, payload: any) {
      // Call original emit
      originalEmit(event, payload)
      
      // Forward event to main thread
      self.postMessage({
        type: 'SERVICE_EVENT',
        event,
        payload
      })
    }
  }
}

/**
 * Handle service messages sent from main thread
 */
async function handleServiceMessage(data: WorkerMessage): Promise<void> {
  const { id, messageType, payload } = data

  if (!serviceInstance) {
    self.postMessage({
      type: 'MESSAGE_RESPONSE',
      id,
      error: 'Service not initialized'
    })
    return
  }

  try {
    // Send message to service instance
    const result = await serviceInstance.send(messageType, payload)
    
    self.postMessage({
      type: 'MESSAGE_RESPONSE',
      id,
      success: true,
      result
    })
  } catch (error) {
    console.error('Worker service message handling failed:', error)
    self.postMessage({
      type: 'MESSAGE_RESPONSE',
      id,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Main message handler for worker
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, ...data } = event.data

  try {
    switch (type) {
      case 'INIT_SERVICE':
        await initializeService({ type, ...data })
        break

      case 'SERVICE_MESSAGE':
        await handleServiceMessage({ type, ...data })
        break

      default:
        console.warn('Unknown message type in worker:', type)
    }
  } catch (error) {
    console.error('Worker message handling error:', error)
  }
}

/**
 * Handle worker errors
 */
self.onerror = (error) => {
  console.error('Worker runtime error:', error)
  self.postMessage({
    type: 'WORKER_ERROR',
    error: typeof error === 'string' ? error : (error as any)?.message || String(error)
  })
}

/**
 * Handle unhandled promise rejections
 */
self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  console.error('Worker unhandled promise rejection:', event.reason)
  self.postMessage({
    type: 'WORKER_ERROR',
    error: event.reason?.message || String(event.reason)
  })
})

// Log worker startup
console.log('🔧 Steward Worker Runtime initialized')

export {} // Make this a module