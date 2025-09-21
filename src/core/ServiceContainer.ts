import { TypedServiceToken, ServiceFromToken } from './ServiceTokens'
import { WorkerServiceClient } from './WorkerServiceClient'

export type ServiceConstructor<T = any> = new (...args: any[]) => T

/**
 * Checks if a service class is marked for worker execution using the @withWorker decorator
 */
function isWorkerService(ServiceConstructor: any): boolean {
  return !!(ServiceConstructor as any).__isWorkerService
}

/**
 * ServiceContainer - Dependency Injection Container for Steward Services
 *
 * The ServiceContainer is responsible for managing the lifecycle and instantiation of services
 * in the Steward framework. It provides a centralized registry for service tokens and handles
 * the complex logic for creating appropriate instances based on service type.
 *
 * ## Key Responsibilities:
 *
 * 1. **Service Registration**: Maps service tokens to their constructor functions
 * 2. **Instance Management**: Creates and caches service instances (singleton pattern)
 * 3. **Worker Service Handling**: Automatically creates WorkerServiceClient instances
 *    for services decorated with @withWorker instead of the actual service
 * 4. **Type Safety**: Ensures proper TypeScript types are maintained throughout the DI system
 *
 * ## Architecture for Worker Services:
 *
 * When a service is decorated with @withWorker('WorkerName'):
 * - The service class is marked with __isWorkerService = true
 * - ServiceContainer detects this flag in resolve()
 * - Instead of creating the service instance directly, it creates a WorkerServiceClient
 * - The WorkerServiceClient communicates with the actual service running in a Web Worker
 * - This maintains the same API surface while transparently moving computation to a worker thread
 *
 * ## Example Usage:
 *
 * ```typescript
 * // 1. Define service and token
 * class MyService extends Service<MyState> { ... }
 * const MyToken = createServiceToken<MyService>('myService')
 *
 * // 2. Register with container
 * container.register(MyToken, MyService)
 *
 * // 3. Resolve when needed
 * const myService = container.resolve(MyToken) // Returns MyService instance
 *
 * // For worker services:
 * @withWorker('MyWorker')
 * class MyWorkerService extends Service<MyState> { ... }
 * const MyWorkerToken = createServiceToken<MyWorkerService>('myWorkerService')
 *
 * container.register(MyWorkerToken, MyWorkerService)
 * const myWorkerService = container.resolve(MyWorkerToken) // Returns WorkerServiceClient instance
 * ```
 *
 * ## Worker Service Flow:
 *
 * 1. Service decorated with @withWorker is registered normally
 * 2. When resolved, isWorkerService() detects the worker flag
 * 3. ServiceContainer creates WorkerServiceClient instead of service instance
 * 4. WorkerServiceClient loads the worker bundle and communicates via postMessage
 * 5. The actual service instance only exists in the worker thread
 * 6. State changes from worker are forwarded to main thread via WorkerServiceClient
 *
 * This architecture ensures:
 * - Main thread never creates worker service instances
 * - Worker services follow the mailbox pattern (no shared callbacks)
 * - Transparent API - consumers don't need to know if service is in worker
 * - Type safety is preserved across the worker boundary
 */
export class ServiceContainer {
  private services = new Map<symbol, any>()
  private instances = new Map<symbol, any>()

  /**
   * Register a service constructor with a token
   *
   * @param token - The service token that uniquely identifies this service
   * @param serviceConstructor - The constructor function for the service class
   */
  register<T extends TypedServiceToken<any>>(token: T, serviceConstructor: ServiceConstructor<ServiceFromToken<T>>): void {
    this.services.set(token.symbol, serviceConstructor)
  }

  /**
   * Resolve a service instance by token (singleton pattern)
   *
   * This is the core method that implements the service instantiation logic:
   *
   * 1. **Check Cache**: Returns existing instance if already created
   * 2. **Worker Detection**: Uses isWorkerService() to detect @withWorker decorator
   * 3. **Instance Creation**:
   *    - For worker services: Creates WorkerServiceClient with proper initial state
   *    - For regular services: Creates service instance directly
   * 4. **Caching**: Stores instance for future requests
   *
   * ## Worker Service Handling:
   *
   * When resolving a worker service:
   * - Calls ServiceConstructor.getInitialState() if available to get shared initial state
   * - Creates WorkerServiceClient(ServiceConstructor, initialState)
   * - WorkerServiceClient handles worker communication transparently
   * - Returns WorkerServiceClient instance that implements same interface as service
   *
   * @param token - The service token to resolve
   * @returns Service instance (or WorkerServiceClient for worker services)
   * @throws Error if service not registered
   */
  resolve<T extends TypedServiceToken<any>>(token: T): ServiceFromToken<T> {
    // Return existing instance if available (singleton pattern)
    const existingInstance = this.instances.get(token.symbol)
    if (existingInstance) {
      return existingInstance as ServiceFromToken<T>
    }

    // Get constructor from registry
    const ServiceConstructor = this.services.get(token.symbol)
    if (!ServiceConstructor) {
      throw new Error(`Service not registered for token: ${token.name}`)
    }

    let instance: any

    if (isWorkerService(ServiceConstructor)) {
      // WORKER SERVICE PATH:
      // Create WorkerServiceClient - the actual service runs in the worker thread
      // Get initial state from static method if available, otherwise use empty object
      const initialState = typeof ServiceConstructor.getInitialState === 'function'
        ? ServiceConstructor.getInitialState()
        : {}
      instance = new WorkerServiceClient(ServiceConstructor, initialState)
    } else {
      // REGULAR SERVICE PATH:
      // Create service instance directly in main thread
      instance = new ServiceConstructor()
    }

    // Cache instance for future requests (singleton pattern)
    this.instances.set(token.symbol, instance)

    return instance as ServiceFromToken<T>
  }

  /**
   * Get the constructor function for a service (for advanced use cases)
   *
   * @param token - The service token
   * @returns The constructor function if registered, undefined otherwise
   */
  getServiceConstructor<T extends TypedServiceToken<any>>(token: T): ServiceConstructor<ServiceFromToken<T>> | undefined {
    return this.services.get(token.symbol) as ServiceConstructor<ServiceFromToken<T>> | undefined
  }

  /**
   * Dispose all service instances and clean up resources
   *
   * This method:
   * 1. Calls clear() on all instances that have this method (for cleanup)
   * 2. Clears the instance cache
   * 3. Leaves service registrations intact for potential reuse
   *
   * Note: WorkerServiceClient instances will terminate their workers when cleared
   */
  dispose(): void {
    // Clear all service instances
    this.instances.forEach(instance => {
      if (instance && typeof instance.clear === 'function') {
        instance.clear()
      }
    })

    this.instances.clear()
  }
}