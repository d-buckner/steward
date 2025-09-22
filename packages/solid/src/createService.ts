import { createServiceActions } from './createServiceActions';
import { createServiceState } from './createServiceState';
import type { TypedServiceToken } from '@d-buckner/steward';

/**
 * Combined primitive that returns both state and actions for a service
 * Provides the complete service interface in one convenient primitive
 *
 * @example
 * ```typescript
 * const { state, actions } = createService(TodoToken)
 *
 * // Use state directly
 * console.log(state.items)
 *
 * // Call actions
 * await actions.addItem('New todo')
 *
 * // Or destructure for convenience
 * const { items, loading } = state
 * const { addItem, removeItem } = actions
 * ```
 */
export function createService<T extends TypedServiceToken>(token: T) {
  const state = createServiceState(token);
  const actions = createServiceActions(token);

  return {
    state,
    actions
  };
}
