// Core message system types and utilities

export interface MessageDefinition {
  [messageType: string]: any
}

export interface Message<T extends MessageDefinition, K extends keyof T = keyof T> {
  type: K
  payload: T[K]
  id: string
  timestamp: number
  correlationId?: string
}

export interface MessageHandler<T extends MessageDefinition> {
  handle<K extends keyof T>(message: Message<T, K>): Promise<void> | void
}

// Utility to generate unique IDs
export function generateMessageId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Helper to create messages
export function createMessage<T extends MessageDefinition, K extends keyof T>(
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
export type MessageFromDefinition<T extends MessageDefinition, K extends keyof T> = Message<T, K>

// Helper to convert UPPER_CASE to camelCase at type level
type ToCamelCase<S extends string> = S extends `${infer P1}_${infer P2}`
  ? `${Lowercase<P1>}${Capitalize<ToCamelCase<P2>>}`
  : Lowercase<S>

// Convert message types to action creators with camelCase method names
export type ServiceActions<T extends MessageDefinition> = {
  [K in keyof T as ToCamelCase<string & K>]: (...args: any[]) => Promise<void>
}