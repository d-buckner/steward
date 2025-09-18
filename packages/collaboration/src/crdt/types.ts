import * as Automerge from '@automerge/automerge'

/**
 * Function type for making changes to an Automerge document
 */
export type ChangeFunction<T> = (doc: T) => void

/**
 * Base interface for CRDT-enabled state
 */
export interface CRDTState extends Record<string, any> {}

/**
 * Automerge document wrapper type
 */
export type CRDTDocument<T extends CRDTState> = Automerge.Doc<T>

/**
 * Sync message for incremental synchronization
 */
export interface SyncMessage {
  data: Uint8Array
  from: string
  to?: string
  timestamp: number
}

/**
 * Network adapter interface for different transport layers
 */
export interface NetworkAdapter {
  send(message: SyncMessage): Promise<void>
  onReceive(handler: (message: SyncMessage) => void): void
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
}