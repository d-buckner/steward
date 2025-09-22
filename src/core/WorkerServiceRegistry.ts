/**
 * Global registry for worker services
 * This allows the framework to auto-discover services marked with @withWorker
 */

export interface WorkerServiceInfo {
  serviceName: string
  serviceClass: new (...args: any[]) => any
  options: {
    name: string
    transferable?: boolean
    workerEntry?: string
  }
}

// Global registry of worker services
const workerServiceRegistry = new Map<string, WorkerServiceInfo>();

/**
 * Register a service for worker usage
 * Called automatically by the @withWorker decorator
 */
export function registerWorkerServiceInfo(info: WorkerServiceInfo): void {
  workerServiceRegistry.set(info.serviceName, info);
}

/**
 * Get all registered worker services
 * Used by the framework to set up worker service imports
 */
export function getRegisteredWorkerServices(): Map<string, WorkerServiceInfo> {
  return new Map(workerServiceRegistry);
}

/**
 * Get specific worker service info
 */
export function getWorkerServiceInfo(serviceName: string): WorkerServiceInfo | undefined {
  return workerServiceRegistry.get(serviceName);
}

/**
 * Clear registry (useful for testing)
 */
export function clearWorkerServiceRegistry(): void {
  workerServiceRegistry.clear();
}
