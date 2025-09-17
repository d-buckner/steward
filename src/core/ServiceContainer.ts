import { TypedServiceToken, ServiceFromToken } from './ServiceTokens'

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

    // Create new instance
    const instance = new ServiceConstructor()
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