/**
 * Reliable Worker Registry
 *
 * A simplified approach to worker service management that eliminates:
 * - Dynamic imports with multiple fallback paths
 * - Runtime service discovery
 * - Complex registry lookup logic
 *
 * Instead, uses build-time service registration with predictable behavior.
 */

export interface ReliableWorkerServiceInfo {
  serviceName: string
  serviceClass: new (...args: any[]) => any
  workerBundle?: string
}

/**
 * Simplified worker registry that uses build-time registration
 * instead of runtime discovery for reliability
 */
class ReliableWorkerRegistryImpl {
  private services = new Map<string, new (...args: any[]) => any>()
  private workerBundles = new Map<string, string>()

  /**
   * Register a service class with optional worker bundle
   * Should be called at build time, not runtime
   */
  registerService(name: string, serviceClass: new (...args: any[]) => any, workerBundle?: string): void {
    this.services.set(name, serviceClass)

    if (workerBundle) {
      this.workerBundles.set(name, workerBundle)
    }
  }

  /**
   * Check if a service is registered
   */
  hasService(name: string): boolean {
    return this.services.has(name)
  }

  /**
   * Get service class constructor
   * Returns undefined if not found (no exceptions thrown)
   */
  getServiceClass(name: string): (new (...args: any[]) => any) | undefined {
    return this.services.get(name)
  }

  /**
   * Get worker bundle URL for a service
   * Returns undefined if no worker bundle is registered
   */
  getWorkerBundle(name: string): string | undefined {
    return this.workerBundles.get(name)
  }

  /**
   * Check if a service is marked for worker execution
   * Uses the @withWorker decorator metadata
   */
  isWorkerService(name: string): boolean {
    const serviceClass = this.services.get(name)
    return serviceClass?.__isWorkerService === true
  }

  /**
   * Get all registered services
   * Useful for build tools and debugging
   */
  getAllServices(): Array<{ name: string, serviceClass: new (...args: any[]) => any, isWorkerService: boolean }> {
    return Array.from(this.services.entries()).map(([name, serviceClass]) => ({
      name,
      serviceClass,
      isWorkerService: this.isWorkerService(name)
    }))
  }

  /**
   * Get all worker services
   * Useful for build tools to generate worker bundles
   */
  getWorkerServices(): Array<{ name: string, serviceClass: new (...args: any[]) => any, workerBundle?: string }> {
    return this.getAllServices()
      .filter(({ isWorkerService }) => isWorkerService)
      .map(({ name, serviceClass }) => ({
        name,
        serviceClass,
        workerBundle: this.getWorkerBundle(name)
      }))
  }

  /**
   * Clear all registrations
   * Useful for testing
   */
  clear(): void {
    this.services.clear()
    this.workerBundles.clear()
  }

  /**
   * Get registry stats for debugging
   */
  getStats(): {
    totalServices: number
    workerServices: number
    mainThreadServices: number
    servicesWithBundles: number
  } {
    const total = this.services.size
    const workers = this.getWorkerServices().length
    const withBundles = this.workerBundles.size

    return {
      totalServices: total,
      workerServices: workers,
      mainThreadServices: total - workers,
      servicesWithBundles: withBundles
    }
  }
}

/**
 * Global singleton registry instance
 */
export const ReliableWorkerRegistry = new ReliableWorkerRegistryImpl()

/**
 * Helper function to register a service
 * Can be used by build tools or manual registration
 */
export function registerReliableWorkerService(
  name: string,
  serviceClass: new (...args: any[]) => any,
  workerBundle?: string
): void {
  ReliableWorkerRegistry.registerService(name, serviceClass, workerBundle)
}

/**
 * Helper function to register multiple services at once
 */
export function registerReliableWorkerServices(services: ReliableWorkerServiceInfo[]): void {
  services.forEach(({ serviceName, serviceClass, workerBundle }) => {
    ReliableWorkerRegistry.registerService(serviceName, serviceClass, workerBundle)
  })
}

/**
 * Type guard to check if a service class has worker metadata
 */
export function hasWorkerMetadata(serviceClass: any): serviceClass is (new (...args: any[]) => any) & {
  __isWorkerService: true
  __workerOptions: any
} {
  return serviceClass?.__isWorkerService === true
}