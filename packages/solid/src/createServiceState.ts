import { createSignal, onCleanup } from 'solid-js'
import { TypedServiceToken, StateFromToken } from '@d-buckner/steward'
import { useServiceContainer } from './ServiceProvider'

// Cache for signals to ensure same signal is returned for same property
const signalCache = new WeakMap<any, Map<string, () => any>>()

// Proxy-based function for automatic reactive access to all state properties
export function createServiceState<T extends TypedServiceToken>(
  serviceToken: T
): StateFromToken<T> {
  const container = useServiceContainer()
  const service = container.resolve(serviceToken)

  // Get or create cache for this service instance
  if (!signalCache.has(service)) {
    signalCache.set(service, new Map())
  }
  const serviceSignals = signalCache.get(service)!

  // Instead of Object.keys(service.state), get keys from the actual service getState method
  const stateKeys = Object.keys(service.getState())
  stateKeys.forEach(key => {
    if (!serviceSignals.has(key)) {
      const [value, setValue] = createSignal(service.state[key])

      const subscription = service.on(key, (newValue) => {
        setValue(newValue)
      })

      onCleanup(() => {
        subscription?.unsubscribe()
        serviceSignals.delete(key)
      })

      serviceSignals.set(key, value)
    }
  })

  return new Proxy({} as StateFromToken<T>, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'string') {
        // Return the cached signal accessor (for reactivity)
        if (serviceSignals.has(prop)) {
          return serviceSignals.get(prop)!()
        }

        // Fallback for properties not in initial state (though this shouldn't happen)
        return service.state[prop]
      }
      return target[prop as keyof StateFromToken<T>]
    },

    // Support for Object.keys(), Object.entries(), etc. and destructuring
    ownKeys() {
      return Object.keys(service.state)
    },

    getOwnPropertyDescriptor(_, prop) {
      if (typeof prop === 'string' && service.state.hasOwnProperty(prop)) {
        return {
          enumerable: true,
          configurable: true,
          value: serviceSignals.has(prop) ? serviceSignals.get(prop)!() : service.state[prop]
        }
      }
      return undefined
    },

    has(_, prop) {
      return typeof prop === 'string' && service.state.hasOwnProperty(prop)
    }
  })
}

// Legacy function for specific state key access (for backward compatibility)
export function createServiceStateKey<T extends TypedServiceToken, K extends keyof StateFromToken<T>>(
  serviceToken: T,
  key: K
): () => StateFromToken<T>[K] | undefined {
  const container = useServiceContainer()
  const service = container.resolve(serviceToken)

  const [value, setValue] = createSignal<StateFromToken<T>[K] | undefined>(
    service.state[key as keyof typeof service.state] as StateFromToken<T>[K] | undefined
  )

  const subscription = service.on(key as string, (newValue: StateFromToken<T>[K]) => {
    setValue(() => newValue)
  })

  onCleanup(() => {
    subscription.unsubscribe()
  })

  return value
}