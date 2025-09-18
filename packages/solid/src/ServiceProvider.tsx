import { ServiceContainer } from '@d-buckner/steward'
import { createContext, useContext, ParentComponent, onMount } from 'solid-js'

const ServiceContainerContext = createContext<ServiceContainer>()

// Development-only devtools interface
interface StewardDevTools {
  container: ServiceContainer
  getState: (serviceName: string) => any
  getAllStates: () => Record<string, any>
  inspect: () => void
  subscriptions: Map<string, string[]>
}

declare global {
  interface Window {
    __STEWARD_DEVTOOLS__?: StewardDevTools
  }
}

export interface ServiceProviderProps {
  container: ServiceContainer
}

export const ServiceProvider: ParentComponent<ServiceProviderProps> = (props) => {
  // Setup development devtools
  onMount(() => {
    // Early return for SSR
    if (typeof window === 'undefined') {
      return
    }
    
    const subscriptions = new Map<string, string[]>()
    
    window.__STEWARD_DEVTOOLS__ = {
        container: props.container,
        
        getState: (serviceName: string) => {
          try {
            // Try to resolve by token name
            const service = (props.container as any).instances?.get(serviceName) || 
                           (props.container as any).resolve(serviceName)
            return service?.getState?.() || service?.state || 'Service not found'
          } catch (e) {
            return `Error: ${e instanceof Error ? e.message : String(e)}`
          }
        },
        
        getAllStates: () => {
          const states: Record<string, any> = {}
          try {
            // Access internal instances map if available
            const instances = (props.container as any).instances
            if (instances && instances instanceof Map) {
              instances.forEach((service: any, token: any) => {
                const tokenName = token.name || token.toString()
                states[tokenName] = service?.getState?.() || service?.state || service
              })
            }
          } catch (e) {
            states.error = `Could not access service instances: ${e instanceof Error ? e.message : String(e)}`
          }
          return states
        },
        
        inspect: () => {
          console.group('🔍 Steward DevTools - Current State')
          const states = window.__STEWARD_DEVTOOLS__!.getAllStates()
          Object.entries(states).forEach(([serviceName, state]) => {
            console.group(`📦 ${serviceName}`)
            console.log(state)
            console.groupEnd()
          })
          console.log('\n💡 Available commands:')
          console.log('  __STEWARD_DEVTOOLS__.getState("serviceName")')
          console.log('  __STEWARD_DEVTOOLS__.getAllStates()')
          console.log('  __STEWARD_DEVTOOLS__.inspect()')
          console.log('  __STEWARD_DEVTOOLS__.subscriptions')
          console.groupEnd()
        },
        
        subscriptions
      }
      
      console.log('🛠️ Steward DevTools ready! Try: __STEWARD_DEVTOOLS__.inspect()')
  })

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