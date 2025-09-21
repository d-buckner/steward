import { Service } from './Service'

// Opaque brand for service tokens to prevent direct type extraction
const ServiceTokenBrand = Symbol('ServiceTokenBrand')

// Base token type - opaque to prevent direct service access
export interface TypedServiceToken<T extends Service = Service> {
  readonly [ServiceTokenBrand]: T
  readonly symbol: symbol
  readonly name: string
  readonly id: string
}

// Service registry interface - users will augment this
export interface ServiceRegistry {}

// Helper to create typed tokens - only way to create service tokens
export function createServiceToken<T extends Service>(name: string): TypedServiceToken<T> {
  return {
    [ServiceTokenBrand]: {} as T,
    symbol: Symbol(name),
    name,
    id: name
  } as TypedServiceToken<T>
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

// Type helper for extracting action types from services
export type ActionsFromToken<T> = ServiceFromToken<T> extends Service<any, infer Actions> ? Actions : never