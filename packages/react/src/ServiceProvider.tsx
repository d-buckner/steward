import { createContext, useContext, ReactNode } from 'react'
import { ServiceContainer } from '@d-buckner/steward'

const ServiceContainerContext = createContext<ServiceContainer | null>(null)

interface ServiceProviderProps {
  container: ServiceContainer
  children: ReactNode
}

export function ServiceProvider({ container, children }: ServiceProviderProps) {
  return (
    <ServiceContainerContext.Provider value={container}>
      {children}
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