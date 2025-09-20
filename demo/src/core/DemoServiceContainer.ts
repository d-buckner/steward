import { ServiceContainer } from '@d-buckner/steward'

/**
 * Demo ServiceContainer - just exports the framework's standard ServiceContainer
 * Worker services are handled automatically by the framework via @withWorker decorator
 */
export class DemoServiceContainer extends ServiceContainer {
  // No custom logic needed - framework handles everything!
}