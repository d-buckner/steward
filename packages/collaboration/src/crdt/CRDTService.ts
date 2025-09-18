import * as Automerge from '@automerge/automerge'
import { Service, ServiceState, ServiceMessages } from '@steward/core'
import { ChangeFunction, CRDTState, CRDTDocument } from './types'

/**
 * CRDTService extends Service to provide collaborative state management
 * using Automerge CRDT for conflict-free distributed state synchronization
 */
export abstract class CRDTService<
  TState extends CRDTState,
  Messages extends ServiceMessages = ServiceMessages
> extends Service<TState, Messages> {
  private doc: CRDTDocument<TState>

  constructor(initialState: TState) {
    // Initialize Automerge document
    const doc = Automerge.from(initialState as any)

    // Initialize Service with initial Automerge state
    super(doc as TState)

    this.doc = doc as CRDTDocument<TState>

    // Override the state proxy to always return from Automerge document
    this.createCRDTStateProxy()
  }

  /**
   * Create a CRDT-specific state proxy that always reads from the Automerge document
   */
  private createCRDTStateProxy(): void {
    // We need to replace the state proxy without redefining it
    // Delete the existing property so we can redefine it
    delete (this as any).state

    Object.defineProperty(this, 'state', {
      get: () => {
        return new Proxy(this.doc, {
          get: (target, prop: string | symbol) => {
            if (typeof prop === 'string') {
              return this.doc[prop as keyof TState]
            }
            return target[prop as keyof TState]
          },
          set: () => {
            throw new Error('Cannot directly modify CRDT state. Use change() method instead.')
          }
        }) as TState
      },
      configurable: true
    })
  }

  /**
   * Make a change to the Automerge document and emit events
   */
  protected change(changeFn: ChangeFunction<TState>): void {
    const oldDoc = this.doc
    const newDoc = Automerge.change(this.doc, changeFn)

    if (newDoc !== this.doc) {
      this.doc = newDoc
      this.emitChangedKeys(oldDoc, newDoc)
    }
  }

  /**
   * Get the underlying Automerge document
   */
  getDocument(): CRDTDocument<TState> {
    return this.doc
  }

  /**
   * Save document as binary for persistence
   */
  save(): Uint8Array {
    return Automerge.save(this.doc)
  }

  /**
   * Load document from binary
   */
  load(binary: Uint8Array): void {
    const loadedDoc = Automerge.load<TState>(binary)

    // When loading, emit all keys since we're replacing the entire document
    this.doc = loadedDoc
    Object.keys(this.doc).forEach(key => {
      const typedKey = key as keyof TState
      super.setState(typedKey, this.doc[typedKey])
    })
  }

  /**
   * Merge changes from another Automerge document
   */
  merge(otherDoc: CRDTDocument<TState>): void {
    const oldDoc = this.doc
    const mergedDoc = Automerge.merge(this.doc, otherDoc)

    if (mergedDoc !== this.doc) {
      this.doc = mergedDoc
      this.emitChangedKeys(oldDoc, mergedDoc)
    }
  }

  /**
   * Generate sync message for incremental synchronization
   * Returns empty array for now - sync methods need refinement
   */
  generateSyncMessage(): Uint8Array {
    return new Uint8Array(0)
  }

  /**
   * Receive and apply sync message from another peer
   * Empty implementation for now - sync methods need refinement
   */
  receiveSyncMessage(_syncMessage: Uint8Array): void {
    // TODO: Implement proper sync message handling
  }

  /**
   * Emit events for keys that changed between two documents
   */
  private emitChangedKeys(oldDoc: CRDTDocument<TState>, newDoc: CRDTDocument<TState>): void {
    // Since Automerge is immutable, reference inequality means the value changed
    Object.keys(newDoc).forEach(key => {
      const typedKey = key as keyof TState
      if (oldDoc[typedKey] !== newDoc[typedKey]) {
        super.setState(typedKey, newDoc[typedKey])
      }
    })
  }

  /**
   * Override getState to return current Automerge document state
   */
  getState(): Record<string, any> {
    return { ...this.doc } as Record<string, any>
  }
}