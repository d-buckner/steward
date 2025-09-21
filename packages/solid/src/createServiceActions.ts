import { TypedServiceToken, ExtractActions, Service } from '@d-buckner/steward'
import { useServiceContainer } from './ServiceProvider'

// Properly typed action creators based on service methods
type ActionsFromToken<T> = T extends TypedServiceToken<infer S>
  ? {
      [K in keyof ExtractActions<S>]: (...args: ExtractActions<S>[K]) => Promise<void>
    }
  : never

export function createServiceActions<T extends TypedServiceToken<any>>(
  serviceToken: T
): ActionsFromToken<T> {
  const container = useServiceContainer()
  const service = container.resolve(serviceToken)

  let availableMethods: string[] = []

  // Get the service constructor to extract method names
  const serviceConstructor = container.getServiceConstructor(serviceToken)

  if (serviceConstructor) {
    // Get methods from the service class prototype
    const prototype = serviceConstructor.prototype
    const allMethods = Object.getOwnPropertyNames(prototype)

    availableMethods = allMethods.filter(name => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
      const isFunction = descriptor && typeof descriptor.value === 'function'
      const isConstructor = name === 'constructor'
      const isBaseMethod = Service.BASE_METHODS.has(name)

      return isFunction && !isConstructor && !isBaseMethod
    })
  } else {
    // Fallback: For regular services, get methods from the instance
    availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(service))
      .filter(name => {
        const method = (service as any)[name]
        return typeof method === 'function' &&
               name !== 'constructor' &&
               !Service.BASE_METHODS.has(name)
      })
  }

  // Use a proxy to intercept method calls and route them as messages
  const proxy = new Proxy({} as ActionsFromToken<T>, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'string' && availableMethods.includes(prop)) {
        // Return a function that calls the method directly on the service client
        return async (...args: any[]) => {
          return (service as any)[prop](...args)
        }
      }
      return target[prop as keyof ActionsFromToken<T>]
    },
    has(_target, prop: string | symbol) {
      return typeof prop === 'string' && availableMethods.includes(prop)
    },
    ownKeys(_target) {
      return availableMethods
    },
    getOwnPropertyDescriptor(_target, prop: string | symbol) {
      if (typeof prop === 'string' && availableMethods.includes(prop)) {
        return {
          enumerable: true,
          configurable: true,
          value: undefined
        }
      }
      return undefined
    }
  })

  return proxy
}