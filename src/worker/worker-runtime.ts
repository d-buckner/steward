/**
 * Worker runtime that executes Steward services in a Web Worker context
 * This file runs inside the worker and handles service instantiation and message routing
 */

// Import necessary types and utilities for worker context
declare const self: Worker & typeof globalThis
declare function importScripts(...urls: string[]): void

interface WorkerMessage {
  type: 'INIT_SERVICE' | 'SERVICE_MESSAGE' | 'WORKER_ERROR'
  id?: string
  serviceName?: string
  initialState?: any
  messageType?: string
  payload?: any
}

import { serviceRegistry } from './worker-registry'

// Global service instance running in this worker
let serviceInstance: any = null

/**
 * Re-export registerWorkerService for backwards compatibility
 * Import from worker-registry to avoid initialization timing issues
 */
export { registerWorkerService } from './worker-registry'

/**
 * Initialize a service instance in the worker context
 */
async function initializeService(data: WorkerMessage): Promise<void> {
  try {
    const { serviceName, initialState } = data

    if (!serviceName) {
      throw new Error('Service name is required for worker initialization')
    }

    console.log(`[WorkerRuntime] 🚀 Starting service initialization`)
    console.log(`[WorkerRuntime] Service name: ${serviceName}`)
    console.log(`[WorkerRuntime] Initial state:`, initialState)
    console.log(`[WorkerRuntime] Registry has services:`, Array.from(serviceRegistry.keys()))

    let ServiceClass: any

    // Try registry first (for pre-registered services)
    console.log(`[WorkerRuntime] 🔍 Looking for service in registry: ${serviceName}`)
    ServiceClass = serviceRegistry.get(serviceName)

    if (ServiceClass) {
      console.log(`[WorkerRuntime] ✅ Found service in registry: ${serviceName}`)
    } else {
      console.log(`[WorkerRuntime] ❌ Service not found in registry, attempting dynamic import`)

      // If not in registry, try to dynamically import the service
      try {
        // Try to import the service from common paths
        const possiblePaths = [
          `./services/${serviceName}`,
          `../services/${serviceName}`,
          `../../services/${serviceName}`,
          `./src/services/${serviceName}`,
          `../src/services/${serviceName}`,
          `../../src/services/${serviceName}`,
          `../../demo/src/services/${serviceName}`
        ]

        console.log(`[WorkerRuntime] 🔄 Trying ${possiblePaths.length} possible import paths...`)

        for (const path of possiblePaths) {
          try {
            console.log(`[WorkerRuntime] 🔄 Trying import path: ${path}`)
            const module = await import(path)
            console.log(`[WorkerRuntime] 📦 Import successful, checking for service class...`)
            ServiceClass = module[serviceName] || module.default
            if (ServiceClass) {
              console.log(`[WorkerRuntime] ✅ Successfully imported ${serviceName} from ${path}`)
              break
            } else {
              console.log(`[WorkerRuntime] ⚠️ Module imported but no ${serviceName} export found`)
            }
          } catch (importError: any) {
            console.log(`[WorkerRuntime] ❌ Failed to import from ${path}:`, importError.message)
            continue
          }
        }
      } catch (dynamicImportError) {
        console.error(`[WorkerRuntime] 💥 Failed to dynamically import service:`, dynamicImportError)
      }
    }

    if (!ServiceClass) {
      const errorMsg = `Service '${serviceName}' not registered in worker and could not be imported. Use registerWorkerService() to register it.`
      console.error(`[WorkerRuntime] 💥 ${errorMsg}`)
      throw new Error(errorMsg)
    }

    console.log(`[WorkerRuntime] 🏗️ Creating service instance...`)
    console.log(`[WorkerRuntime] Using initial state:`, initialState ? 'provided' : 'default constructor')

    // Create service instance with initial state if provided
    serviceInstance = initialState ? new ServiceClass(initialState) : new ServiceClass()
    console.log(`[WorkerRuntime] ✅ Service instance created successfully:`, serviceInstance)
    console.log(`[WorkerRuntime] Service instance type:`, serviceInstance.constructor.name)

    // Set up event forwarding to main thread
    console.log(`[WorkerRuntime] 📡 Setting up event forwarding...`)
    setupEventForwarding()
    console.log(`[WorkerRuntime] ✅ Event forwarding configured`)

    // Notify main thread of successful initialization
    console.log(`[WorkerRuntime] 📤 Sending success response to main thread`)
    self.postMessage({
      type: 'INIT_SERVICE',
      success: true
    })
    console.log(`[WorkerRuntime] ✅ Initialization complete!`)

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
  console.log(`[WorkerRuntime.handleServiceMessage] 📥 Received service message:`)
  console.log(`[WorkerRuntime.handleServiceMessage] Message ID: ${id}`)
  console.log(`[WorkerRuntime.handleServiceMessage] Message type: ${messageType}`)
  console.log(`[WorkerRuntime.handleServiceMessage] Payload:`, payload)
  console.log(`[WorkerRuntime.handleServiceMessage] Service instance available:`, !!serviceInstance)

  if (!serviceInstance) {
    console.error(`[WorkerRuntime.handleServiceMessage] ❌ No service instance available`)
    self.postMessage({
      type: 'MESSAGE_RESPONSE',
      id,
      error: 'Service not initialized'
    })
    return
  }

  try {
    // Call the service method directly using auto-derived actions
    console.log(`[WorkerRuntime.handleServiceMessage] 🔍 Looking for method: ${messageType}`)
    console.log(`[WorkerRuntime.handleServiceMessage] Available methods:`, Object.getOwnPropertyNames(Object.getPrototypeOf(serviceInstance)))

    const method = serviceInstance[messageType as string]
    console.log(`[WorkerRuntime.handleServiceMessage] Found method:`, !!method)
    console.log(`[WorkerRuntime.handleServiceMessage] Method type:`, typeof method)

    if (typeof method !== 'function') {
      const errorMsg = `Method ${messageType} not found on service`
      console.error(`[WorkerRuntime.handleServiceMessage] ❌ ${errorMsg}`)
      throw new Error(errorMsg)
    }

    // Call the method with the payload arguments
    console.log(`[WorkerRuntime.handleServiceMessage] 🚀 Calling method with payload:`, payload)
    console.log(`[WorkerRuntime.handleServiceMessage] Payload is array:`, Array.isArray(payload))

    const result = Array.isArray(payload)
      ? await method.apply(serviceInstance, payload)
      : await method.call(serviceInstance, payload)

    console.log(`[WorkerRuntime.handleServiceMessage] ✅ Method completed successfully`)
    console.log(`[WorkerRuntime.handleServiceMessage] Result:`, result)

    console.log(`[WorkerRuntime.handleServiceMessage] 📤 Sending success response`)
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
 * Initialize worker runtime only if we're actually in a worker context
 */
function initializeWorkerRuntime() {
  // Only run worker code if we're in an actual worker context
  if (typeof self !== 'undefined' && typeof importScripts === 'function') {
    /**
     * Main message handler for worker
     */
    self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
      const { type, ...data } = event.data
      console.log(`[WorkerRuntime] 📥 Received message from main thread:`)
      console.log(`[WorkerRuntime] Message type: ${type}`)
      console.log(`[WorkerRuntime] Message data:`, data)

      try {
        switch (type) {
          case 'INIT_SERVICE':
            console.log(`[WorkerRuntime] 🎯 Handling INIT_SERVICE`)
            await initializeService({ type, ...data })
            break

          case 'SERVICE_MESSAGE':
            console.log(`[WorkerRuntime] 💬 Handling SERVICE_MESSAGE`)
            await handleServiceMessage({ type, ...data })
            break

          case 'WORKER_ERROR':
            console.log(`[WorkerRuntime] ⚠️ WORKER_ERROR message received (outgoing only, ignoring)`)
            // This message type is for outgoing errors, not incoming
            // It should not be processed here
            break

          default:
            console.warn(`[WorkerRuntime] ⚠️ Unknown message type in worker: ${type}`)
        }
      } catch (error) {
        console.error(`[WorkerRuntime] 💥 Worker message handling error:`, error)
        self.postMessage({
          type: 'WORKER_ERROR',
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
    console.log(`[WorkerRuntime] 🔧 Steward Worker Runtime initialized successfully`)
    console.log(`[WorkerRuntime] 📋 Worker context ready for service registration and messaging`)
    console.log(`[WorkerRuntime] 🌐 Worker environment:`, {
      location: self.location?.href || 'unknown',
      navigator: self.navigator?.userAgent || 'unknown'
    })
  }
}

// Initialize the worker runtime
initializeWorkerRuntime()

export {} // Make this a module