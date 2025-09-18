// Core services  
export { Service } from './core/Service'
export { CRDTService } from './core/CRDTService'
export { ServiceEventBus } from './core/ServiceEventBus'
export { ServiceContainer } from './core/ServiceContainer'

// Worker support
export { withWorker, isWorkerService, getWorkerOptions } from './core/WorkerDecorator'
export { WorkerProxy } from './core/WorkerProxy'
export type { WorkerOptions } from './core/WorkerDecorator'
export * from './core/Messages'
export * from './core/MessageActions'

// Service Tokens
export * from './core/ServiceTokens'

// Types
export type { EventBus, EventHandler, EventSubscription } from './types'
export type { ServiceConstructor } from './core/ServiceContainer'
export type { ChangeFunction } from './core/CRDTService'

// Headless service utilities
export * from './headless'