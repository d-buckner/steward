import { registerWorkerServiceInfo } from './WorkerServiceRegistry';
import type { Service } from './Service';


export interface WorkerOptions {
  /**
   * Name for the worker (useful for debugging)
   */
  name: string

  /**
   * Whether to transfer ownership of ArrayBuffers/ImageBitmaps to worker
   * @default false
   */
  transferable?: boolean

  /**
   * Custom worker entry point URL
   * If not provided, uses the default framework worker entry
   */
  workerEntry?: string
}

/**
 * Decorator that marks a service to run in a Web Worker
 *
 * @example
 * ```typescript
 * @withWorker('DataProcessor')
 * class DataProcessingService extends Service<State, Messages> {
 *   // This service will automatically run in a worker
 * }
 *
 * @withWorker({ name: 'DataProcessor', workerEntry: './my-worker.ts' })
 * class CustomWorkerService extends Service<State, Messages> {
 *   // This service will use a custom worker entry
 * }
 * ```
 */
export function withWorker(nameOrOptions: string | WorkerOptions) {
  return function<T extends new (...args: any[]) => Service<any, any>>(target: T): T {
    const options: WorkerOptions = typeof nameOrOptions === 'string'
      ? { name: nameOrOptions, transferable: false }
      : { transferable: false, ...nameOrOptions }

    // Mark the service class as a worker service
    ;(target as any).__isWorkerService = true
    ;(target as any).__workerOptions = options

    // Store original class info for worker instantiation
    ;(target as any).__workerServiceName = target.name
    ;(target as any).__workerServiceCode = target.toString();

    // Register this service for auto-discovery
    registerWorkerServiceInfo({
      serviceName: target.name,
      serviceClass: target,
      options
    });


    return target;
  };
}

/**
 * Type guard to check if a service class is marked for worker execution
 */
export function isWorkerService(serviceClass: any): serviceClass is (new (...args: any[]) => Service<any, any>) & {
  __isWorkerService: true
  __workerOptions: WorkerOptions
  __workerServiceName: string
  __workerServiceCode: string
} {
  return serviceClass?.__isWorkerService === true;
}

/**
 * Get worker options for a worker service class
 */
export function getWorkerOptions(serviceClass: any): WorkerOptions {
  return serviceClass?.__workerOptions || {};
}
