/**
 * Integration layer for using @steward/collaboration with @steward/core
 * This module provides easy imports for the most common use cases
 */

// Re-export core Steward functionality that works with collaboration
export { Service, ServiceEventBus, ServiceContainer } from '@steward/core'
export type { ServiceState, ServiceMessages } from '@steward/core'

// Export collaboration features
export { CRDTService } from './crdt/CRDTService'
export type { ChangeFunction, CRDTState, CRDTDocument } from './crdt/types'

/**
 * Helper function to create a collaborative service
 * This is a convenience function that extends CRDTService
 */
export function createCollaborativeService<TState extends Record<string, any>>(
  initialState: TState
) {
  return class extends CRDTService<TState> {
    constructor() {
      super(initialState)
    }
  }
}