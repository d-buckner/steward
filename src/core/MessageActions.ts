import { MessageDefinition } from './Messages'
import { Service } from './Service'

// Convert snake_case/UPPER_CASE message types to camelCase method names
function toCamelCase(str: string): string {
  return str.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

// Type for action creator functions that map parameters to payloads
export type ActionCreatorFunction<T> = (...args: any[]) => T

// Type for action creators mapping
export type ActionCreators<Messages extends MessageDefinition> = {
  [K in keyof Messages]?: ActionCreatorFunction<Messages[K]>
}

// Create action creators from message definitions with optional custom mappings
export function createMessageActions<
  State extends Record<string, any>,
  Messages extends MessageDefinition
>(
  service: Service<State, Messages>,
  messageTypes: (keyof Messages)[],
  customActions?: ActionCreators<Messages>
): any {
  const actions = {} as any
  
  messageTypes.forEach(type => {
    const methodName = toCamelCase(String(type))
    const customAction = customActions?.[type]
    
    if (customAction) {
      // Use custom parameter mapping
      actions[methodName] = async (...args: any[]) => {
        const payload = customAction(...args)
        return service.send(type, payload)
      }
    } else {
      // Default behavior: single param or empty
      actions[methodName] = async (payload?: any) => {
        return service.send(type, payload || {})
      }
    }
  })
  
  return actions
}

// Utility to extract message type keys from a message service
export function getMessageTypes<
  State extends Record<string, any>,
  Messages extends MessageDefinition
>(
  service: Service<State, Messages>
): (keyof Messages)[] {
  // In practice, this would be provided via metadata or registered explicitly
  // For now, we'll rely on the service implementation to provide this
  return (service as any).__messageTypes || []
}

// Decorator to register message types and optional action creators on a service class
export function withMessages<Messages extends MessageDefinition>(
  messageTypes: (keyof Messages)[],
  actionCreators?: ActionCreators<Messages>
) {
  return function<T extends new (...args: any[]) => Service<any, Messages>>(
    constructor: T
  ) {
    // Store message types and action creators on the constructor for reflection
    ;(constructor.prototype as any).__messageTypes = messageTypes
    ;(constructor.prototype as any).__actionCreators = actionCreators
    return constructor
  }
}