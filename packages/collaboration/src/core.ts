/**
 * Integration layer for using @steward/collaboration with @steward/core
 * This module provides easy imports for the most common use cases
 */

// Re-export core Steward functionality that works with collaboration
export { Service, ServiceEventBus, ServiceContainer } from '@d-buckner/steward'
export type { ServiceState, ServiceActions } from '@d-buckner/steward'

// Export collaboration features
export { CRDTService } from './crdt/CRDTService'
export type { ChangeFunction, CRDTState, CRDTDocument } from './crdt/types'

// Import types for function
import { CRDTService } from './crdt/CRDTService'

/**
 * Helper function to create a collaborative service
 * This is a convenience function that extends CRDTService
 */
export function createCollaborativeService<TState extends Record<string, any>>(
  initialState: TState
): new () => CRDTService<TState> {
  return class CollaborativeService extends CRDTService<TState> {
    constructor() {
      super(initialState)
    }
  }
}