import { useState, useEffect } from 'react'
import { TypedServiceToken, StateFromToken } from '@d-buckner/steward'
import { useServiceContainer } from './ServiceProvider'

export function useServiceState<
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