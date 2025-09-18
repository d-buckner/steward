// Core services
export { Service } from './core/Service'
export { ServiceEventBus } from './core/ServiceEventBus'
export { ServiceContainer } from './core/ServiceContainer'

// Worker support
export { withWorker, isWorkerService, getWorkerOptions } from './core/WorkerDecorator'
export { WorkerProxy } from './core/WorkerProxy'
export { registerWorkerService } from './worker/worker-runtime'
export type { WorkerOptions } from './core/WorkerDecorator'
export * from './core/Messages'
export * from './core/MessageActions'

// Service Tokens
export { createServiceToken } from './core/ServiceTokens'
export type { TypedServiceToken, ServiceRegistry } from './core/ServiceTokens'

// Service Base Types
export type { ServiceState, ServiceMessages } from './core/ServiceTypes'

// Types
export type { EventBus, EventHandler, EventSubscription } from './types'
export type { ServiceConstructor } from './core/ServiceContainer'

// Headless service utilities
export * from './headless'