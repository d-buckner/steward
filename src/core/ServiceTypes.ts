/**
 * Core service type definitions
 * These base types ensure all services follow consistent patterns
 */

import { MessageDefinition } from './Messages'

/**
 * Base type for all service state objects
 * Services can use this as a constraint for their state
 */
export type ServiceState = Record<string, any>

/**
 * Base type for all service message definitions
 * Services can use this as a constraint for their messages
 */
export type ServiceMessages = MessageDefinition