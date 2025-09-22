// Core services
export { Service } from './core/Service';
export { ServiceEventBus } from './core/ServiceEventBus';
export { ServiceContainer } from './core/ServiceContainer';

// Worker support
export { withWorker, isWorkerService, getWorkerOptions } from './core/WorkerDecorator';
export type { WorkerOptions } from './core/WorkerDecorator';

// Worker service registry
export {
  getRegisteredWorkerServices,
  getWorkerServiceInfo,
  clearWorkerServiceRegistry
} from './core/WorkerServiceRegistry';
export type { WorkerServiceInfo } from './core/WorkerServiceRegistry';

// Worker registry - only for use in worker contexts
export { registerWorkerService } from './worker/worker-registry';

// Message handling
export * from './core/Messages';

// Service Tokens
export { createServiceToken } from './core/ServiceTokens';
export type {
  TypedServiceToken,
  ServiceRegistry,
  ServiceFromToken,
  StateFromToken,
  ActionsFromToken
} from './core/ServiceTokens';

// Service Base Types
export type { ServiceState, ServiceActions, ExtractActions } from './core/ServiceTypes';

// Utilities
export { ServiceStateObserver } from './core/ServiceStateObserver';

// Types
export type { EventBus, EventHandler, EventSubscription } from './types';
export type { ServiceConstructor } from './core/ServiceContainer';

// Build plugins are available via '@d-buckner/steward/vite'
