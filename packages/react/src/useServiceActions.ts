import { useMemo } from 'react'
import { 
  TypedServiceToken, 
  ServiceFromToken, 
  Service,
  MessageService,
  ServiceActions as MessageServiceActions
} from '@d-buckner/steward'
import { useServiceContainer } from './ServiceProvider'

// For regular services - extract methods
type ServiceMethods<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never
}

type PublicServiceMethods<T extends Service> = Omit<
  ServiceMethods<T>,
  keyof Service | 'constructor'
>

// For message services - create action creators
type ServiceActions<T extends TypedServiceToken> = 
  ServiceFromToken<T> extends MessageService<any, infer Messages>
    ? MessageServiceActions<Messages>
    : PublicServiceMethods<ServiceFromToken<T>>

export function useServiceActions<T extends TypedServiceToken>(
  token: T
): ServiceActions<T> {
  const container = useServiceContainer()
  const service = container.resolve(token)
  
  return useMemo(() => {
    // Check if this is a MessageService
    if (service instanceof MessageService) {
      const messageService = service as MessageService<any, any>
      const messageTypes = (service as any).__messageTypes || []
      const actionCreators = (service as any).__actionCreators || {}
      
      const actions = {} as any
      
      // Convert message types to camelCase action creators
      messageTypes.forEach((type: string) => {
        const methodName = toCamelCase(type)
        const customAction = actionCreators[type]
        
        if (customAction) {
          // Use custom parameter mapping
          actions[methodName] = async (...args: any[]) => {
            const payload = customAction(...args)
            return messageService.send(type, payload)
          }
        } else {
          // Default behavior: single param or empty
          actions[methodName] = async (payload?: any) => {
            return messageService.send(type, payload || {})
          }
        }
      })
      
      return actions
    } else {
      // Fall back to method extraction for regular services
      const actions = {} as any
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
        return descriptor && typeof service[name as keyof ServiceFromToken<T>] === 'function'
      })
      
      // Bind each method to the service instance
      methodNames.forEach(methodName => {
        const method = service[methodName as keyof ServiceFromToken<T>] as any
        if (typeof method === 'function') {
          actions[methodName] = method.bind(service)
        }
      })
      
      return actions
    }
  }, [service])
}

// Utility function to convert message types to camelCase
function toCamelCase(str: string): string {
  return str.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}