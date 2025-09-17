import { Service } from '@d-buckner/steward'

type ServiceActions<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never
}

type PublicServiceActions<T extends Service> = Omit<
  ServiceActions<T>,
  keyof Service | 'constructor'
>

export function createServiceActions<T extends Service>(
  service: T
): PublicServiceActions<T> {
  const actions = {} as PublicServiceActions<T>
  const prototype = Object.getPrototypeOf(service)
  const baseServicePrototype = Service.prototype
  
  // Get all method names from the service prototype chain
  const methodNames = Object.getOwnPropertyNames(prototype).filter(name => {
    // Skip constructor
    if (name === 'constructor') return false
    
    // Skip if it's a base Service method
    if (name in baseServicePrototype) return false
    
    // Only include functions
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
    return descriptor && typeof service[name as keyof T] === 'function'
  })
  
  // Bind each method to the service instance
  methodNames.forEach(methodName => {
    const method = service[methodName as keyof T] as any
    if (typeof method === 'function') {
      (actions as any)[methodName] = method.bind(service)
    }
  })
  
  return actions
}