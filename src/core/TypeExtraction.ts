/**
 * Type utilities for extracting action types from service classes
 */

import type { Service } from './Service';

/**
 * Extract base methods from the Service class
 * This automatically derives what methods should be excluded from action detection
 */
type BaseServiceMethods = keyof Service<any, any>

/**
 * Extract action methods from a service class
 * This derives the Actions interface automatically from the service's public methods
 * by excluding methods that exist on the base Service class
 */
export type ExtractActions<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any
    ? K extends string
      ? K extends BaseServiceMethods
        ? never
        : K
      : never
    : never]: T[K] extends (...args: infer P) => any ? P : never
}
