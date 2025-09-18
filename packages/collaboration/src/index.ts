// CRDT exports
export { CRDTService } from './crdt/CRDTService'
export type {
  ChangeFunction,
  CRDTState,
  CRDTDocument,
  SyncMessage,
  NetworkAdapter
} from './crdt/types'

// Re-export all CRDT functionality
export * from './crdt'

// Future exports for other collaboration features
// export * from './sync'
// export * from './presence'
// export * from './conflict'