import { Service } from './Service'

export interface WorkerOptions {
  /**
   * Optional name for the worker (useful for debugging)
   */
  name?: string
  
  /**
   * Whether to transfer ownership of ArrayBuffers/ImageBitmaps to worker
   * @default false
   */
  transferable?: boolean
}

/**
 * Decorator that marks a service to run in a Web Worker
 * 
 * @example
 * ```typescript
 * @withWorker({ name: 'DataProcessor' })
 * @withMessages<DataMessages>([...])
 * class DataProcessingService extends Service<State, Messages> {
 *   // This service will automatically run in a worker
 * }
 * ```
 */
export function withWorker(options: WorkerOptions = {}) {
  return function<T extends typeof Service>(target: T) {
    // Mark the service class as a worker service
    ;(target as any).__isWorkerService = true
    ;(target as any).__workerOptions = options
    
    // Store original class info for worker instantiation
    ;(target as any).__workerServiceName = target.name
    ;(target as any).__workerServiceCode = target.toString()
    
    return target
  }
}

/**
 * Type guard to check if a service class is marked for worker execution
 */
export function isWorkerService(serviceClass: any): serviceClass is typeof Service & {
  __isWorkerService: true
  __workerOptions: WorkerOptions
  __workerServiceName: string
  __workerServiceCode: string
} {
  return serviceClass?.__isWorkerService === true
}

/**
 * Get worker options for a worker service class
 */
export function getWorkerOptions(serviceClass: any): WorkerOptions {
  return serviceClass?.__workerOptions || {}
}