import {
  Service
} from '@d-buckner/steward';
import { useMemo } from 'react';
import { useServiceContainer } from './ServiceProvider';
import type {
  TypedServiceToken,
  ExtractActions} from '@d-buckner/steward';

// Properly typed action creators based on service methods
type ActionsFromToken<T> = T extends TypedServiceToken<infer S>
  ? {
      [K in keyof ExtractActions<S>]: (...args: ExtractActions<S>[K]) => void
    }
  : never

export function useServiceActions<T extends TypedServiceToken<any>>(
  token: T
): ActionsFromToken<T> {
  const container = useServiceContainer();
  const service = container.resolve(token);

  return useMemo(() => {
    let availableMethods: string[] = [];

    // Get the service constructor to extract method names
    const serviceConstructor = container.getServiceConstructor(token);

    if (serviceConstructor) {
      // Get methods from the service class prototype
      const prototype = serviceConstructor.prototype;
      availableMethods = Object.getOwnPropertyNames(prototype)
        .filter(name => {
          const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
          return descriptor &&
                 typeof descriptor.value === 'function' &&
                 name !== 'constructor' &&
                 !Service.BASE_METHODS.has(name);
        });
    } else {
      // Fallback: For regular services, get methods from the instance
      availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(service))
        .filter(name => {
          const method = (service as any)[name];
          return typeof method === 'function' &&
                 name !== 'constructor' &&
                 !Service.BASE_METHODS.has(name);
        });
    }

    // Use a proxy to intercept method calls and route them as messages
    return new Proxy({} as ActionsFromToken<T>, {
      get(target, prop: string | symbol) {
        if (typeof prop === 'string' && availableMethods.includes(prop)) {
          // Return a function that calls the method via ServiceClient (fire-and-forget)
          return (...args: any[]) => {
            (service as any)[prop](...args);
          };
        }
        return target[prop as keyof ActionsFromToken<T>];
      },
      has(_target, prop: string | symbol) {
        return typeof prop === 'string' && availableMethods.includes(prop);
      },
      ownKeys(_target) {
        return availableMethods;
      },
      getOwnPropertyDescriptor(_target, prop: string | symbol) {
        if (typeof prop === 'string' && availableMethods.includes(prop)) {
          return {
            enumerable: true,
            configurable: true,
            value: undefined
          };
        }
        return undefined;
      }
    });
  }, [service, container, token]);
}

