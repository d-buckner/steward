/**
 * Worker service registry - separate from runtime to avoid initialization timing issues
 */

// Global service registry for worker
export const serviceRegistry = new Map<string, new (...args: any[]) => any>()

/**
 * Register a service class in the worker runtime
 * This avoids the need for eval by pre-registering service constructors
 */
export function registerWorkerService(name: string, serviceClass: new (...args: any[]) => any): void {
  console.log(`[WorkerRegistry] 📝 Registering service: ${name}`)
  serviceRegistry.set(name, serviceClass)
  console.log(`[WorkerRegistry] ✅ Service ${name} registered. Registry now has: [${Array.from(serviceRegistry.keys()).join(', ')}]`)
}
