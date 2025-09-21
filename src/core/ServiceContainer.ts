import { TypedServiceToken, ServiceFromToken } from './ServiceTokens'
import { WorkerServiceClient } from './WorkerServiceClient'
import { ServiceClient } from './ServiceClient'
import { Service } from './Service'

export type ServiceConstructor<T extends Service = Service> = new (...args: ServiceFromToken<TypedServiceToken<Service>>[]) => T

export interface ServiceRegistrationOptions {
  dependencies?: TypedServiceToken<Service>[]
}

// Internal type - ServiceClient should never appear in public APIs
type InternalServiceClient<T extends Service> = ServiceClient<T>

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
  private services = new Map<symbol, ServiceConstructor>()
  private serviceInstances = new Map<symbol, Service>()
  private internalClients = new Map<symbol, InternalServiceClient<Service>>()
  private registrationOptions = new Map<symbol, ServiceRegistrationOptions>()

  /**
   * Register a service constructor with a token and optional dependencies
   * Creates the appropriate client immediately based on service type
   *
   * @param token - The service token that uniquely identifies this service
   * @param serviceConstructor - The constructor function for the service class
   * @param options - Registration options including dependencies
   */
  register<T extends TypedServiceToken<Service>>(
    token: T,
    serviceConstructor: ServiceConstructor<ServiceFromToken<T>>,
    options?: ServiceRegistrationOptions
  ): void {
    // Store constructor and options for potential future use
    this.services.set(token.symbol, serviceConstructor)
    if (options) {
      this.registrationOptions.set(token.symbol, options)
    }

    // Create appropriate client based on service type
    const client = this.createClientForService(token, serviceConstructor, options)
    this.internalClients.set(token.symbol, client)
  }

  /**
   * Create the appropriate client for a service based on its type (PRIVATE)
   *
   * This method handles:
   * 1. Worker services - creates WorkerServiceClient
   * 2. Local services - creates ServiceClient wrapping the service instance
   */
  private createClientForService<T extends TypedServiceToken<Service>>(
    token: T,
    serviceConstructor: ServiceConstructor<ServiceFromToken<T>>,
    options?: ServiceRegistrationOptions
  ): InternalServiceClient<Service> {
    if (isWorkerService(serviceConstructor)) {
      // WORKER SERVICE: Create WorkerServiceClient directly
      const initialState = typeof (serviceConstructor as any).getInitialState === 'function'
        ? (serviceConstructor as any).getInitialState()
        : {}
      return new WorkerServiceClient(serviceConstructor, initialState) as any
    } else {
      // LOCAL SERVICE: Create service instance and wrap in ServiceClient
      const serviceInstance = this.createServiceInstance(token, serviceConstructor, options)
      return new ServiceClient(
        token as any,
        () => serviceInstance,
        undefined // Not a worker service
      )
    }
  }

  /**
   * Resolve a service by token
   *
   * Returns the pre-created service client with full type safety. All communication
   * automatically follows the mailbox pattern for location transparency.
   *
   * @param token - The service token to resolve
   * @returns The service client instance
   * @throws Error if service not registered
   */
  resolve<T extends TypedServiceToken<Service>>(token: T): ServiceFromToken<T> {
    const client = this.internalClients.get(token.symbol)
    if (!client) {
      throw new Error(`Service not registered for token: ${token.name}`)
    }

    return client as unknown as ServiceFromToken<T>
  }

  /**
   * Create a local service instance with dependency injection (PRIVATE)
   *
   * This method handles:
   * 1. Dependency resolution - resolves all dependency tokens to clients
   * 2. Constructor injection - passes dependency clients to service constructor
   * Note: Only used for local services, worker services are handled separately
   */
  private createServiceInstance<T extends TypedServiceToken<Service>>(
    token: T,
    serviceConstructor: ServiceConstructor<ServiceFromToken<T>>,
    options?: ServiceRegistrationOptions
  ): ServiceFromToken<T> {
    // Return existing service instance if available
    const existingInstance = this.serviceInstances.get(token.symbol)
    if (existingInstance) {
      return existingInstance as ServiceFromToken<T>
    }

    // Create local service instance with dependency injection
    const dependencyClients = this.resolveDependencies(options?.dependencies || [])
    const instance = new serviceConstructor(...dependencyClients)

    // Cache service instance
    this.serviceInstances.set(token.symbol, instance)

    return instance as ServiceFromToken<T>
  }

  /**
   * Resolve dependency tokens to services
   */
  private resolveDependencies(dependencies: TypedServiceToken<Service>[]): ServiceFromToken<TypedServiceToken<Service>>[] {
    return dependencies.map(depToken => this.resolve(depToken))
  }

  /**
   * Get the constructor function for a service (for advanced use cases)
   *
   * @param token - The service token
   * @returns The constructor function if registered, undefined otherwise
   */
  getServiceConstructor<T extends TypedServiceToken<Service>>(token: T): ServiceConstructor<ServiceFromToken<T>> | undefined {
    return this.services.get(token.symbol) as ServiceConstructor<ServiceFromToken<T>> | undefined
  }

  /**
   * Dispose all service instances and clean up resources
   *
   * This method:
   * 1. Calls dispose() on all services for cleanup
   * 2. Calls clear() on all service instances that have this method
   * 3. Clears all caches
   * 4. Leaves service registrations intact for potential reuse
   */
  dispose(): void {
    // Clean up all service proxies
    this.internalClients.forEach(serviceProxy => {
      if (serviceProxy && typeof serviceProxy.dispose === 'function') {
        serviceProxy.dispose()
      }
    })

    // Clear all service instances
    this.serviceInstances.forEach(instance => {
      if (instance && typeof instance.clear === 'function') {
        instance.clear()
      }
    })

    this.internalClients.clear()
    this.serviceInstances.clear()
  }
}