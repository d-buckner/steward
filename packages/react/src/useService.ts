import { TypedServiceToken } from '@d-buckner/steward'
import { useServiceState } from './useServiceState'
import { useServiceActions } from './useServiceActions'

/**
 * Combined hook that returns both state and actions for a service
 * Provides the complete service interface in one convenient hook
 *
 * @example
 * ```typescript
 * const { state, actions } = useService(TodoToken)
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
export function useService<T extends TypedServiceToken>(token: T) {
  const state = useServiceState(token)
  const actions = useServiceActions(token)

  return {
    state,
    actions
  }
}