import { TypedServiceToken, ServiceFromToken } from './ServiceTokens'
import { isWorkerService, getWorkerOptions } from './WorkerDecorator'
import { WorkerProxy } from './WorkerProxy'

export type ServiceConstructor<T = any> = new (...args: any[]) => T

export class ServiceContainer {
  private services = new Map<symbol, any>()
  private instances = new Map<symbol, any>()

  register<T extends TypedServiceToken<any>>(token: T, serviceConstructor: ServiceConstructor<ServiceFromToken<T>>): void {
    this.services.set(token.symbol, serviceConstructor)
  }

  resolve<T extends TypedServiceToken<any>>(token: T): ServiceFromToken<T> {
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

      // Get initial state by creating a temporary instance of the service
      // This is safe because we only need the initial state, not to run the service
      let initialState: any = {}
      try {
        const tempInstance = new ServiceConstructor()
        initialState = tempInstance.getState()

        // Clean up the temporary instance if it has a cleanup method
        if (typeof tempInstance.clear === 'function') {
          tempInstance.clear()
        }
      } catch (error) {
        initialState = {}
      }

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

      if (process.env.NODE_ENV === 'development') {
        console.log(`🔧 Created service: ${token.name}`)
      }
    }

    this.instances.set(token.symbol, instance)
    
    return instance as ServiceFromToken<T>
  }

  getServiceConstructor<T extends TypedServiceToken<any>>(token: T): ServiceConstructor<ServiceFromToken<T>> | undefined {
    console.log(`[ServiceContainer.getServiceConstructor] Looking for token:`, token)
    console.log(`[ServiceContainer.getServiceConstructor] Token symbol:`, token.symbol)
    console.log(`[ServiceContainer.getServiceConstructor] Available services:`, Array.from(this.services.keys()))

    const constructor = this.services.get(token.symbol) as ServiceConstructor<ServiceFromToken<T>> | undefined
    console.log(`[ServiceContainer.getServiceConstructor] Found constructor:`, constructor)
    console.log(`[ServiceContainer.getServiceConstructor] Constructor name:`, constructor?.name)

    return constructor
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