/**
 * Reliable Service Container
 *
 * A simplified ServiceContainer that uses:
 * - ReliableWorkerRegistry for predictable service discovery
 * - ReliableWorkerProxy for automatic main thread fallback
 * - No complex fallback logic or dynamic imports
 */

import { TypedServiceToken, ServiceFromToken } from './ServiceTokens'
import { ReliableWorkerRegistry } from './ReliableWorkerRegistry'
import { ReliableWorkerProxy } from './ReliableWorkerProxy'
import { isWorkerService, getWorkerOptions } from './WorkerDecorator'

export type ServiceConstructor<T = any> = new (...args: any[]) => T

export class ReliableServiceContainer {
  private instances = new Map<symbol, any>()

  /**
   * Register a service with the reliable registry
   * This should be called at build time, not runtime
   */
  register<T extends TypedServiceToken<any>>(
    token: T,
    serviceConstructor: ServiceConstructor<ServiceFromToken<T>>,
    workerBundle?: string
  ): void {
    // Register in the reliable registry
    ReliableWorkerRegistry.registerService(
      token.name,
      serviceConstructor,
      workerBundle
    )
  }

  /**
   * Resolve a service instance
   * Creates ReliableWorkerProxy for worker services, regular instances for others
   */
  resolve<T extends TypedServiceToken<any>>(token: T): ServiceFromToken<T> {
    // Return existing instance if available
    const existingInstance = this.instances.get(token.symbol)
    if (existingInstance) {
      return existingInstance as ServiceFromToken<T>
    }

    // Get service class from reliable registry
    const ServiceConstructor = ReliableWorkerRegistry.getServiceClass(token.name)
    if (!ServiceConstructor) {
      throw new Error(`Service not registered for token: ${token.name}`)
    }

    let instance: any

    // Check if service should run in a worker
    if (ReliableWorkerRegistry.isWorkerService(token.name)) {
      // Create reliable worker proxy
      const workerBundle = ReliableWorkerRegistry.getWorkerBundle(token.name)

      // Get initial state from a temporary instance (for typing)
      const tempInstance = new ServiceConstructor()
      const initialState = tempInstance.getState()
      tempInstance.clear()

      instance = new ReliableWorkerProxy(ServiceConstructor, initialState)

      // Initialize with worker bundle if available
      instance.initialize(workerBundle).catch((error: Error) => {
        console.warn(`[ReliableServiceContainer] Worker initialization failed for ${token.name}:`, error.message)
      })

      if (process.env.NODE_ENV === 'development') {
        console.log(`🔧 Created reliable worker service: ${token.name}`, { workerBundle })
      }
    } else {
      // Create regular service instance
      instance = new ServiceConstructor()

      if (process.env.NODE_ENV === 'development') {
        console.log(`📦 Created main thread service: ${token.name}`)
      }
    }

    this.instances.set(token.symbol, instance)
    return instance as ServiceFromToken<T>
  }

  /**
   * Get the original service constructor (for utilities like action creation)
   */
  getServiceConstructor<T extends TypedServiceToken<any>>(
    token: T
  ): ServiceConstructor<ServiceFromToken<T>> | undefined {
    return ReliableWorkerRegistry.getServiceClass(token.name) as ServiceConstructor<ServiceFromToken<T>> | undefined
  }

  /**
   * Check if a service is registered
   */
  hasService<T extends TypedServiceToken<any>>(token: T): boolean {
    return ReliableWorkerRegistry.hasService(token.name)
  }

  /**
   * Get information about a service
   */
  getServiceInfo<T extends TypedServiceToken<any>>(token: T): {
    isRegistered: boolean
    isWorkerService: boolean
    hasWorkerBundle: boolean
    workerBundle?: string
  } {
    const isRegistered = ReliableWorkerRegistry.hasService(token.name)
    const isWorkerService = ReliableWorkerRegistry.isWorkerService(token.name)
    const workerBundle = ReliableWorkerRegistry.getWorkerBundle(token.name)

    return {
      isRegistered,
      isWorkerService,
      hasWorkerBundle: !!workerBundle,
      workerBundle
    }
  }

  /**
   * Get registry statistics
   */
  getStats() {
    return ReliableWorkerRegistry.getStats()
  }

  /**
   * Dispose all service instances and clean up resources
   */
  dispose(): void {
    this.instances.forEach(instance => {
      if (instance && typeof instance.clear === 'function') {
        instance.clear()
      }
    })

    this.instances.clear()

    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 ReliableServiceContainer disposed')
    }
  }

  /**
   * Register multiple services at once
   * Useful for build tools
   */
  registerServices(services: Array<{
    token: TypedServiceToken<any>
    serviceConstructor: ServiceConstructor
    workerBundle?: string
  }>): void {
    services.forEach(({ token, serviceConstructor, workerBundle }) => {
      this.register(token, serviceConstructor, workerBundle)
    })
  }

  /**
   * Preload a service (create instance but don't return it)
   * Useful for worker services that take time to initialize
   */
  async preload<T extends TypedServiceToken<any>>(token: T): Promise<void> {
    const instance = this.resolve(token)

    // If it's a ReliableWorkerProxy, wait for initialization
    if (instance && typeof (instance as any).initialize === 'function') {
      const workerBundle = ReliableWorkerRegistry.getWorkerBundle(token.name)
      await (instance as any).initialize(workerBundle)
    }
  }

  /**
   * Preload multiple services concurrently
   */
  async preloadServices<T extends TypedServiceToken<any>>(tokens: T[]): Promise<void> {
    await Promise.all(tokens.map(token => this.preload(token)))
  }
}