import { useMemo } from 'react'
import {
  TypedServiceToken,
  ExtractActions
} from '@d-buckner/steward'
import { useServiceContainer } from './ServiceProvider'

// Properly typed action creators based on service methods
type ActionsFromToken<T> = T extends TypedServiceToken<infer S>
  ? {
      [K in keyof ExtractActions<S>]: (...args: ExtractActions<S>[K]) => Promise<void>
    }
  : never

export function useServiceActions<T extends TypedServiceToken<any>>(
  token: T
): ActionsFromToken<T> {
  const container = useServiceContainer()
  const service = container.resolve(token)

  return useMemo(() => {
    // List of Service base methods that should not be exposed as actions
    // This mirrors the ExtractActions type logic but is more reliable at runtime
    const baseServiceMethods = new Set([
      'send', 'request', 'on', 'off', 'once', 'removeAllListeners',
      'hasListeners', 'getListenerCount', 'getState', 'clear',
      'getMessageHistory', 'clearMessageHistory', 'replayMessages', 'resolveRequest',
      'setState', 'setStates', 'updateState', 'handle'
    ])

    // Check if this is a WorkerProxy (worker service)
    const isWorkerProxy = service.constructor.name === 'WorkerProxy' ||
                         (typeof (service as any).send === 'function' &&
                          'state' in service &&
                          Object.getOwnPropertyNames(Object.getPrototypeOf(service)).includes('handleWorkerMessage'))
    let availableMethods: string[] = []

    if (isWorkerProxy) {
      // For worker services, get the methods from the original service class
      const serviceConstructor = container.getServiceConstructor(token)
      if (serviceConstructor) {
        // Get methods from the service class prototype
        const prototype = serviceConstructor.prototype
        availableMethods = Object.getOwnPropertyNames(prototype)
          .filter(name => {
            const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
            return descriptor &&
                   typeof descriptor.value === 'function' &&
                   name !== 'constructor' &&
                   !baseServiceMethods.has(name)
          })
      }
    } else {
      // For regular services, get methods from the instance
      availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(service))
        .filter(name => {
          const method = (service as any)[name]
          return typeof method === 'function' &&
                 name !== 'constructor' &&
                 !baseServiceMethods.has(name)
        })
    }

    // Use a proxy to intercept method calls and route them as messages
    return new Proxy({} as ActionsFromToken<T>, {
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
  }, [service, container, token])
}

