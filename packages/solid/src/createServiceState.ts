import { createSignal, onCleanup } from 'solid-js'
import { TypedServiceToken, StateFromToken } from '@d-buckner/steward'
import { useServiceContainer } from './ServiceProvider'

export function createServiceState<T extends TypedServiceToken, K extends keyof StateFromToken<T>>(
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