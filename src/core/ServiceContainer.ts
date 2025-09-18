import { TypedServiceToken, ServiceFromToken } from './ServiceTokens'
import { isWorkerService, getWorkerOptions } from './WorkerDecorator'
import { WorkerProxy } from './WorkerProxy'

export type ServiceConstructor<T = any> = new (...args: any[]) => T

export class ServiceContainer {
  private services = new Map<symbol, any>()
  private instances = new Map<symbol, any>()

  register<T extends TypedServiceToken>(token: T, serviceConstructor: ServiceConstructor<ServiceFromToken<T>>): void {
    this.services.set(token.symbol, serviceConstructor)
  }

  resolve<T extends TypedServiceToken>(token: T): ServiceFromToken<T> {
    // Return existing instance if available
    const existingInstance = this.instances.get(token.symbol)
    if (existingInstance) {
      return existingInstance as ServiceFromToken<T>
    }

    // Get constructor
    const ServiceConstructor = this.services.get(token.symbol)
    if (!ServiceConstructor) {
      throw new Error(`Service not registered for token: ${token.name}`)
    }

    let instance: any

    // Check if service should run in a worker
    if (isWorkerService(ServiceConstructor)) {
      // Create worker proxy instead of direct service instance
      const workerOptions = getWorkerOptions(ServiceConstructor)
      
      // Get initial state - assume empty state for now since we can't instantiate abstract services
      const initialState = {} as any
      
      instance = new WorkerProxy(
        ServiceConstructor,
        initialState,
        workerOptions
      )
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔧 Created worker service: ${token.name}`, workerOptions)
      }
    } else {
      // Create regular service instance
      instance = new ServiceConstructor()
    }

    this.instances.set(token.symbol, instance)
    
    return instance as ServiceFromToken<T>
  }

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