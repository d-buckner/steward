// Core message system types and utilities

// Base type for all service action definitions
// Enforces camelCase action names: unknown[] pattern
export type ServiceActions = {
  [actionName: string]: unknown[]
}

export interface Message<T extends ServiceActions, K extends keyof T = keyof T> {
  type: K
  payload: T[K]
  id: string
  timestamp: number
  correlationId?: string
}

export interface MessageHandler<T extends ServiceActions> {
  handle<K extends keyof T>(message: Message<T, K>): Promise<void> | void
}

// Utility to generate unique IDs
export function generateMessageId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Helper to create messages
export function createMessage<T extends ServiceActions, K extends keyof T>(
  type: K,
  payload: T[K],
  correlationId?: string
): Message<T, K> {
  return {
    type,
    payload,
    id: generateMessageId(),
    timestamp: Date.now(),
    correlationId
  }
}

// Type helpers for message-driven services
export type MessageFromDefinition<T extends ServiceActions, K extends keyof T> = Message<T, K>

// Action creators directly map to action names (no conversion needed)
export type ActionCreators<T extends ServiceActions> = {
  [K in keyof T]: (...args: any[]) => Promise<void>
}