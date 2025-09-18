import { TypedServiceToken, ServiceFromToken, isWorkerService, getWorkerOptions } from '@d-buckner/steward'
import { DemoWorkerProxy } from './DemoWorkerProxy'

/**
 * Demo-specific ServiceContainer that uses DemoWorkerProxy for worker services
 * This avoids MIME type issues with the library's worker loading
 */
export class DemoServiceContainer {
  private instances = new Map<symbol, unknown>()
  private services = new Map<symbol, new (...args: any[]) => any>()

  register<T extends TypedServiceToken>(token: T, serviceConstructor: new (...args: any[]) => any): void {
    this.services.set(token.symbol, serviceConstructor)
  }

  resolve<T extends TypedServiceToken>(token: T): ServiceFromToken<T> {
    // Check if we already have an instance
    const existingInstance = this.instances.get(token.symbol)
    if (existingInstance) {
      return existingInstance as ServiceFromToken<T>
    }

    // Get constructor
    const ServiceConstructor = this.services.get(token.symbol)
    if (!ServiceConstructor) {
      throw new Error(`Service not registered for token: ${token.name}`)
    }

    let instance: ServiceFromToken<T>

    // Check if service should run in a worker
    if (isWorkerService(ServiceConstructor)) {
      // Use our demo-specific worker proxy instead of the library's WorkerProxy
      const workerOptions = getWorkerOptions(ServiceConstructor)
      
      // Get initial state - assume empty state for now since we can't instantiate abstract services
      const initialState = {}
      
      instance = new DemoWorkerProxy(
        ServiceConstructor,
        initialState,
        workerOptions
      ) as ServiceFromToken<T>
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔧 Created demo worker service: ${token.name}`, workerOptions)
        console.log('🔍 Worker service metadata:', {
          messageTypes: ServiceConstructor.__messageTypes,
          actionCreators: ServiceConstructor.__actionCreators
        })
      }
    } else {
      // Create regular service instance
      instance = new ServiceConstructor() as ServiceFromToken<T>
    }

    // Cache instance
    this.instances.set(token.symbol, instance)
    return instance
  }

  dispose(): void {
    // Clean up all instances
    for (const instance of this.instances.values()) {
      if (instance && typeof (instance as any).clear === 'function') {
        (instance as any).clear()
      }
    }
    this.instances.clear()
  }
}