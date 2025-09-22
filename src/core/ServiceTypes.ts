/**
 * Core service type definitions
 * These base types ensure all services follow consistent patterns
 */

/**
 * Base type for all service state objects
 * Services can use this as a constraint for their state
 */
export type ServiceState = Record<string, any>


/**
 * Re-export ServiceActions from Messages.ts for convenience
 * Enforces camelCase action names: unknown[] pattern
 */
export type { ServiceActions } from './Messages';

/**
 * Re-export ExtractActions from TypeExtraction to avoid circular imports
 */
export type { ExtractActions } from './TypeExtraction';
