import type { Service } from './Service';

// Opaque brand for service tokens to prevent direct type extraction
const ServiceTokenBrand = Symbol('ServiceTokenBrand');

// Base token type - opaque to prevent direct service access
export interface TypedServiceToken<T extends Service<any, any> = Service<any, any>> {
  readonly [ServiceTokenBrand]: T
  readonly symbol: symbol
  readonly name: string
  readonly id: string
}

// Service registry interface - users will augment this
export interface ServiceRegistry {
  // Users will augment this interface in their applications
  [serviceName: string]: any;
}

/**
 * Create a typed service token for dependency injection
 *
 * Service tokens uniquely identify services in the container and provide
 * type safety for service resolution. Each service should have exactly one token.
 *
 * @param name - Unique name for the service (used for debugging)
 * @returns A typed service token for use with ServiceContainer
 *
 * @example
 * ```typescript
 * // Define your service
 * class CounterService extends Service<CounterState> {
 *   // ... service implementation
 * }
 *
 * // Create a token
 * export const CounterToken = createServiceToken<CounterService>('counter')
 *
 * // Register with container
 * container.register(CounterToken, CounterService)
 *
 * // Use in components
 * const { state, actions } = useService(CounterToken)
 * ```
 *
 * @template T - The service class type
 */
export function createServiceToken<T extends Service<any, any>>(name: string): TypedServiceToken<T> {
  return {
    [ServiceTokenBrand]: {} as T,
    symbol: Symbol(name),
    name,
    id: name
  } as TypedServiceToken<T>;
}

// Registry interface for all service tokens - provides typed access
export interface ServiceTokenRegistry {
  // Users will augment this in their applications like:
  // declare module '@d-buckner/steward' {
  //   interface ServiceTokenRegistry {
  //     Todo: TypedServiceToken<TodoService>
  //   }
  // }
  [tokenName: string]: TypedServiceToken<any>;
}

// Type helpers for extracting service types from tokens
export type ServiceFromToken<T> = T extends TypedServiceToken<infer S> ? S : never
export type StateFromToken<T> = ServiceFromToken<T> extends Service<infer State> ? State : never

// Type helper for extracting action types from services
export type ActionsFromToken<T> = ServiceFromToken<T> extends Service<any, infer Actions> ? Actions : never
