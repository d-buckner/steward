import { Service } from './Service'
import { MessageService } from './MessageService'

// Base token type
export interface TypedServiceToken<T extends Service = Service> {
  readonly __type: T
  readonly symbol: symbol
  readonly name: string
}

// Service registry interface - users will augment this
export interface ServiceRegistry {}

// Helper to create typed tokens
export function createServiceToken<T extends Service>(name: string): TypedServiceToken<T> {
  return {
    __type: {} as T,
    symbol: Symbol(name),
    name
  }
}

// Namespace for all service tokens - provides ServiceToken.Name API
export namespace ServiceToken {
  // Users will augment this in their applications like:
  // declare module 'steward' {
  //   namespace ServiceToken {
  //     export const Todo: TypedServiceToken<TodoService>
  //   }
  // }
}

// Type helpers for extracting service types from tokens
export type ServiceFromToken<T> = T extends TypedServiceToken<infer S> ? S : never
export type StateFromToken<T> = ServiceFromToken<T> extends Service<infer State> ? State : never

// Type helper for extracting message types from message services
export type MessagesFromToken<T> = ServiceFromToken<T> extends MessageService<any, infer Messages> ? Messages : never