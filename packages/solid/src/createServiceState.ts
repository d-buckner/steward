import { createSignal, onCleanup } from 'solid-js'
import { Service } from '@d-buckner/steward'

export function createServiceState<TState extends Record<string, any>, K extends keyof TState>(
  service: Service<TState>,
  key: K
): () => TState[K] | undefined {
  const [value, setValue] = createSignal<TState[K] | undefined>(
    service.state[key] as TState[K] | undefined
  )

  const subscription = service.on(key as string, (newValue: TState[K]) => {
    setValue(() => newValue)
  })

  onCleanup(() => {
    subscription.unsubscribe()
  })

  return value
}