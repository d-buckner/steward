import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Automerge from '@automerge/automerge'
import { CRDTService } from '../src/core/CRDTService'

// Test collaborative state
interface InstrumentState {
  instruments: { [userId: string]: { type: string; volume: number } }
  tempo: number
  isPlaying: boolean
}

class InstrumentService extends CRDTService<InstrumentState> {
  constructor() {
    super({
      instruments: {},
      tempo: 120,
      isPlaying: false
    })
  }

  setInstrument(userId: string, type: string, volume: number) {
    this.change(doc => {
      if (!doc.instruments) {
        doc.instruments = {}
      }
      doc.instruments[userId] = { type, volume }
    })
  }

  setTempo(tempo: number) {
    this.change(doc => {
      doc.tempo = tempo
    })
  }

  togglePlayback() {
    this.change(doc => {
      doc.isPlaying = !doc.isPlaying
    })
  }
}

describe('CRDTService', () => {
  let service: InstrumentService

  beforeEach(() => {
    service = new InstrumentService()
  })

  describe('Basic Automerge Integration', () => {
    it('should initialize with default state', () => {
      expect(service.state.tempo).toBe(120)
      expect(service.state.isPlaying).toBe(false)
      expect(service.state.instruments).toEqual({})
    })

    it('should update state via change method', () => {
      service.setTempo(140)
      
      expect(service.state.tempo).toBe(140)
    })

    it('should emit events when state changes', () => {
      const tempoHandler = vi.fn()
      const playingHandler = vi.fn()
      
      service.on('tempo', tempoHandler)
      service.on('isPlaying', playingHandler)
      
      service.setTempo(140)
      service.togglePlayback()
      
      expect(tempoHandler).toHaveBeenCalledWith(140)
      expect(playingHandler).toHaveBeenCalledWith(true)
    })

    it('should handle complex nested state changes', () => {
      const instrumentsHandler = vi.fn()
      service.on('instruments', instrumentsHandler)
      
      service.setInstrument('user1', 'piano', 0.8)
      service.setInstrument('user2', 'drums', 0.6)
      
      expect(service.state.instruments).toEqual({
        user1: { type: 'piano', volume: 0.8 },
        user2: { type: 'drums', volume: 0.6 }
      })
      
      expect(instrumentsHandler).toHaveBeenCalledTimes(2)
    })
  })

  describe('Automerge Document Access', () => {
    it('should provide access to underlying Automerge document', () => {
      service.setTempo(140)
      
      const doc = service.getDocument()
      expect(Automerge.getHeads(doc)).toBeDefined()
      expect(doc.tempo).toBe(140)
    })

    it('should allow getting document as binary', () => {
      service.setTempo(140)
      service.setInstrument('user1', 'piano', 0.8)
      
      const binary = service.save()
      expect(binary).toBeInstanceOf(Uint8Array)
      expect(binary.length).toBeGreaterThan(0)
    })

    it('should allow loading from binary', () => {
      // Create initial state
      service.setTempo(140)
      service.setInstrument('user1', 'piano', 0.8)
      
      const binary = service.save()
      
      // Create new service and load
      const newService = new InstrumentService()
      newService.load(binary)
      
      expect(newService.state.tempo).toBe(140)
      expect(newService.state.instruments).toEqual({
        user1: { type: 'piano', volume: 0.8 }
      })
    })
  })

  describe('Collaborative Features', () => {
    it('should provide merge and sync methods for future network integration', () => {
      const service1 = new InstrumentService()
      
      // Basic API should be available
      expect(typeof service1.merge).toBe('function')
      expect(typeof service1.generateSyncMessage).toBe('function')
      expect(typeof service1.receiveSyncMessage).toBe('function')
      expect(typeof service1.save).toBe('function')
      expect(typeof service1.load).toBe('function')
    })
  })

  describe('Event System Integration', () => {
    it('should work with Service event bus methods', () => {
      const handler = vi.fn()
      
      // Service event bus methods should work
      const subscription = service.on('tempo', handler)
      
      service.setTempo(140)
      
      expect(handler).toHaveBeenCalledWith(140)
      
      subscription.unsubscribe()
      service.setTempo(150)
      
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should support getCurrentState for full state access', () => {
      service.setTempo(140)
      service.setInstrument('user1', 'piano', 0.8)
      service.togglePlayback()
      
      const fullState = service.getCurrentState()
      
      expect(fullState).toEqual({
        tempo: 140,
        instruments: { user1: { type: 'piano', volume: 0.8 } },
        isPlaying: true
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid merge documents gracefully', () => {
      const invalidDoc = {} as any
      
      expect(() => {
        service.merge(invalidDoc)
      }).toThrow()
    })

    it('should handle invalid sync messages gracefully', () => {
      const invalidSyncMessage = new Uint8Array([1, 2, 3])
      
      // Current implementation is empty, so this should not throw
      expect(() => {
        service.receiveSyncMessage(invalidSyncMessage)
      }).not.toThrow()
    })
  })
})