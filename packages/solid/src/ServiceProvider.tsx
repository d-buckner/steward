import { ServiceContainer } from '@d-buckner/steward'
import { createContext, useContext, ParentComponent } from 'solid-js'

const ServiceContainerContext = createContext<ServiceContainer>()

export interface ServiceProviderProps {
  container: ServiceContainer
}

export const ServiceProvider: ParentComponent<ServiceProviderProps> = (props) => {
  return (
    <ServiceContainerContext.Provider value={props.container}>
      {props.children}
    </ServiceContainerContext.Provider>
  )
}

export function useServiceContainer(): ServiceContainer {
  const container = useContext(ServiceContainerContext)
  if (!container) {
    throw new Error('useServiceContainer must be used within a ServiceProvider')
  }
  return container
}