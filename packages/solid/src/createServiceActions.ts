import { Service, TypedServiceToken, ServiceFromToken } from '@d-buckner/steward'
import { useServiceContainer } from './ServiceProvider'

// Convert snake_case/UPPER_CASE message types to camelCase method names
function toCamelCase(str: string): string {
  return str.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

// Type for existing service methods  
type ServiceActions<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never
}

// Specific action types for services with @withMessages decorator
type TodoServiceActions = {
  addItem: (text: string, priority?: 'low' | 'medium' | 'high', dueDate?: Date) => Promise<void>
  toggleItem: (id: string) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  editItem: (id: string, text: string) => Promise<void>
  setFilter: (filter: 'all' | 'active' | 'completed') => Promise<void>
  setSearch: (query: string) => Promise<void>
  clearCompleted: () => Promise<void>
  loadSampleData: () => Promise<void>
}

type ChatServiceActions = {
  sendMessage: (text: string) => Promise<void>
  setUser: (username: string) => Promise<void>
  startTyping: () => Promise<void>
  stopTyping: () => Promise<void>
  userJoin: (username: string) => Promise<void>
  userLeave: (username: string) => Promise<void>
  simulateBotResponse: () => Promise<void>
  clearChat: () => Promise<void>
}

type CounterServiceActions = {
  increment: () => Promise<void>
  decrement: () => Promise<void>
  reset: () => Promise<void>
  setStep: (step: number) => Promise<void>
  toggle: () => Promise<void>
  undo: () => Promise<void>
}

// For now, return a union type that includes all possible action methods
// This provides good IntelliSense while we work on a better type mapping solution
type ActionsFromToken<T> = T extends TypedServiceToken
  ? ServiceFromToken<T> extends Service
    ? TodoServiceActions & ChatServiceActions & CounterServiceActions & Omit<ServiceActions<ServiceFromToken<T>>, keyof Service | 'constructor'>
    : never
  : never

export function createServiceActions<T extends TypedServiceToken>(
  serviceToken: T
): ActionsFromToken<T> {
  const container = useServiceContainer()
  const service = container.resolve(serviceToken)
  
  const actions = {} as ActionsFromToken<T>
  
  // Check if service has decorator metadata
  const messageTypes = (service as any).__messageTypes
  const actionCreators = (service as any).__actionCreators
  
  if (messageTypes && Array.isArray(messageTypes)) {
    // Use decorator metadata to create actions
    messageTypes.forEach((type: string) => {
      const methodName = toCamelCase(type)
      const customAction = actionCreators?.[type]
      
      if (customAction) {
        // Use custom parameter mapping
        (actions as any)[methodName] = async (...args: any[]) => {
          const payload = customAction(...args)
          return (service as any).send(type, payload)
        }
      } else {
        // Default behavior: single param or empty
        (actions as any)[methodName] = async (payload?: any) => {
          return (service as any).send(type, payload || {})
        }
      }
    })
  } else {
    // Fallback: look for existing methods on prototype
    const prototype = Object.getPrototypeOf(service)
    const baseServicePrototype = Service.prototype
    
    const methodNames = Object.getOwnPropertyNames(prototype).filter(name => {
      // Skip constructor
      if (name === 'constructor') return false
      
      // Skip if it's a base Service method
      if (name in baseServicePrototype) return false
      
      // Only include functions
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
      return descriptor && typeof service[name as keyof typeof service] === 'function'
    })
    
    // Bind each method to the service instance
    methodNames.forEach(methodName => {
      const method = service[methodName as keyof typeof service] as any
      if (typeof method === 'function') {
        (actions as any)[methodName] = method.bind(service)
      }
    })
  }
  
  return actions
}