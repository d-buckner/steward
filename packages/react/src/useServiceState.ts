import { useState, useEffect, useMemo } from 'react'
import { TypedServiceToken, StateFromToken } from '@d-buckner/steward'
import { useServiceContainer } from './ServiceProvider'

// Cache for state subscriptions to ensure same state object is returned for same service
const stateCache = new WeakMap<any, StateFromToken<any>>()

// Proxy-based hook for automatic reactive access to all state properties
export function useServiceState<T extends TypedServiceToken>(
  token: T
): StateFromToken<T> {
  const container = useServiceContainer()
  const service = container.resolve(token)

  // Force re-render when any state property changes
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    // Get all state keys and subscribe to all of them
    const stateKeys = Object.keys(service.getState())
    const subscriptions = stateKeys.map(key =>
      service.on(key, () => {
        forceUpdate(prev => prev + 1) // Force re-render
      })
    )

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe())
    }
  }, [service])

  return useMemo(() => {
    // Check if we already have a cached state proxy for this service
    if (stateCache.has(service)) {
      return stateCache.get(service)!
    }

    // Create a new proxy that provides reactive access to state properties
    const stateProxy = new Proxy({} as StateFromToken<T>, {
      get(target, prop: string | symbol) {
        if (typeof prop === 'string') {
          return service.state[prop]
        }
        return target[prop as keyof StateFromToken<T>]
      },

      // Support for Object.keys(), Object.entries(), etc. and destructuring
      ownKeys() {
        return Object.keys(service.getState())
      },

      getOwnPropertyDescriptor(_, prop) {
        if (typeof prop === 'string' && service.getState().hasOwnProperty(prop)) {
          return {
            enumerable: true,
            configurable: true,
            value: service.state[prop]
          }
        }
        return undefined
      },

      has(_, prop) {
        return typeof prop === 'string' && service.getState().hasOwnProperty(prop)
      }
    })

    stateCache.set(service, stateProxy)
    return stateProxy
  }, [service])
}

// Legacy hook for specific state key access (for backward compatibility)
export function useServiceStateKey<
  T extends TypedServiceToken,
  K extends keyof StateFromToken<T>
>(
  token: T,
  key: K
): StateFromToken<T>[K] | undefined {
  const container = useServiceContainer()
  const service = container.resolve(token)

  const [value, setValue] = useState<StateFromToken<T>[K] | undefined>(() =>
    service.state[key as string] as StateFromToken<T>[K] | undefined
  )

  useEffect(() => {
    const subscription = service.on(key as string, (newValue: StateFromToken<T>[K]) => {
      setValue(newValue)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [service, key])

  return value
}