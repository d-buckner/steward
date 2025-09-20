import { TypedServiceToken, ExtractActions } from '@d-buckner/steward'
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
  console.log(`[createServiceActions] === STARTING CREATESERVICEACTIONS ===`)
  const container = useServiceContainer()
  console.log(`[createServiceActions] Container from hook:`, container)
  console.log(`[createServiceActions] Container constructor:`, container.constructor.name)
  console.log(`[createServiceActions] Token:`, serviceToken)
  console.log(`[createServiceActions] Token name:`, serviceToken.name)
  console.log(`[createServiceActions] Token symbol:`, serviceToken.symbol)

  const service = container.resolve(serviceToken)
  console.log(`[createServiceActions] Resolved service:`, service)

  // List of Service base methods that should not be exposed as actions
  // This mirrors the ExtractActions type logic but is more reliable at runtime
  const baseServiceMethods = new Set([
    'send', 'request', 'on', 'off', 'once', 'removeAllListeners',
    'hasListeners', 'getListenerCount', 'getState', 'clear',
    'getMessageHistory', 'clearMessageHistory', 'replayMessages', 'resolveRequest',
    'setState', 'setStates', 'updateState', 'handle'
  ])

  // Check if this is a WorkerProxy (worker service)
  console.log(`[createServiceActions] Service constructor name:`, service.constructor.name)
  console.log(`[createServiceActions] Service instance:`, service)
  console.log(`[createServiceActions] Service has state property:`, 'state' in service)
  console.log(`[createServiceActions] Service has send method:`, typeof (service as any).send)
  console.log(`[createServiceActions] Service prototype:`, Object.getPrototypeOf(service))
  console.log(`[createServiceActions] Service prototype names:`, Object.getOwnPropertyNames(Object.getPrototypeOf(service)))

  let availableMethods: string[] = []

  // Always try to get the service constructor first, regardless of service type
  const serviceConstructor = container.getServiceConstructor(serviceToken)
  console.log(`[createServiceActions] Service constructor from container:`, serviceConstructor)

  if (serviceConstructor) {
    console.log(`[createServiceActions] Using service constructor approach`)
    // Get methods from the service class prototype
    const prototype = serviceConstructor.prototype
    console.log(`[createServiceActions] Service prototype:`, prototype)
    console.log(`[createServiceActions] All prototype properties:`, Object.getOwnPropertyNames(prototype))

    const allMethods = Object.getOwnPropertyNames(prototype)
    console.log(`[createServiceActions] All methods before filtering:`, allMethods)

    availableMethods = allMethods.filter(name => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
      const isFunction = descriptor && typeof descriptor.value === 'function'
      const isConstructor = name === 'constructor'
      const isBaseMethod = baseServiceMethods.has(name)

      console.log(`[createServiceActions] Method ${name}:`, {
        isFunction,
        isConstructor,
        isBaseMethod,
        include: isFunction && !isConstructor && !isBaseMethod
      })

      return isFunction && !isConstructor && !isBaseMethod
    })

    console.log(`[createServiceActions] Filtered available methods:`, availableMethods)
  } else {
    console.log(`[createServiceActions] No service constructor found, using instance approach`)
    // Fallback: For regular services, get methods from the instance
    availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(service))
      .filter(name => {
        const method = (service as any)[name]
        return typeof method === 'function' &&
               name !== 'constructor' &&
               !baseServiceMethods.has(name)
      })
  }

  // Detect if this is a worker proxy for the send method
  const isWorkerProxy = typeof (service as any).send === 'function' &&
                        'state' in service &&
                        service.constructor.name !== serviceConstructor?.name

  console.log(`[createServiceActions] Service type: ${isWorkerProxy ? 'WorkerProxy' : 'Regular'}`)
  console.log(`[createServiceActions] Available methods:`, availableMethods)
  console.log(`[createServiceActions] Available methods length:`, availableMethods.length)

  // Use a proxy to intercept method calls and route them as messages
  const proxy = new Proxy({} as ActionsFromToken<T>, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'string' && availableMethods.includes(prop)) {
        // Return a function that sends the message to the service
        return async (...args: any[]) => {
          return (service as any).send(prop, args)
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

  console.log(`[createServiceActions] === CREATED PROXY ===`)
  console.log(`[createServiceActions] Proxy:`, proxy)
  console.log(`[createServiceActions] Proxy keys:`, Object.keys(proxy))
  console.log(`[createServiceActions] Proxy ownKeys:`, Object.getOwnPropertyNames(proxy))
  console.log(`[createServiceActions] === RETURNING PROXY ===`)

  return proxy
}