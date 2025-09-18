import { describe, it, expect, vi } from 'vitest'
import { ServiceEventBus } from '../src/core/ServiceEventBus'

interface TestEvents {
  stringEvent: string
  numberEvent: number
  objectEvent: { id: number; name: string }
}

describe('ServiceEventBus', () => {
  describe('Basic Event Operations', () => {
    it('should emit and receive events', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler = vi.fn()
      
      bus.on('stringEvent', handler)
      bus.emit('stringEvent', 'test')
      
      expect(handler).toHaveBeenCalledWith('test')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should store current state when emitting', () => {
      const bus = new ServiceEventBus<TestEvents>()
      
      bus.emit('stringEvent', 'test')
      bus.emit('numberEvent', 42)
      
      expect(bus.get('stringEvent')).toBe('test')
      expect(bus.get('numberEvent')).toBe(42)
    })

    it('should return undefined for events that have not been emitted', () => {
      const bus = new ServiceEventBus<TestEvents>()
      
      expect(bus.get('stringEvent')).toBeUndefined()
    })

    it('should update current state on subsequent emissions', () => {
      const bus = new ServiceEventBus<TestEvents>()
      
      bus.emit('stringEvent', 'first')
      expect(bus.get('stringEvent')).toBe('first')
      
      bus.emit('stringEvent', 'second')
      expect(bus.get('stringEvent')).toBe('second')
    })
  })

  describe('Subscription Management', () => {
    it('should return subscription object with unsubscribe method', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler = vi.fn()
      
      const subscription = bus.on('stringEvent', handler)
      
      expect(subscription).toHaveProperty('unsubscribe')
      expect(typeof subscription.unsubscribe).toBe('function')
    })

    it('should unsubscribe using subscription object', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler = vi.fn()
      
      const subscription = bus.on('stringEvent', handler)
      subscription.unsubscribe()
      
      bus.emit('stringEvent', 'test')
      expect(handler).not.toHaveBeenCalled()
    })

    it('should unsubscribe using off method', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler = vi.fn()
      
      bus.on('stringEvent', handler)
      bus.off('stringEvent', handler)
      
      bus.emit('stringEvent', 'test')
      expect(handler).not.toHaveBeenCalled()
    })

    it('should support multiple listeners for same event', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      bus.on('stringEvent', handler1)
      bus.on('stringEvent', handler2)
      
      bus.emit('stringEvent', 'test')
      
      expect(handler1).toHaveBeenCalledWith('test')
      expect(handler2).toHaveBeenCalledWith('test')
    })

    it('should only remove specific handler when multiple exist', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      bus.on('stringEvent', handler1)
      bus.on('stringEvent', handler2)
      bus.off('stringEvent', handler1)
      
      bus.emit('stringEvent', 'test')
      
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledWith('test')
    })
  })

  describe('Once Subscription', () => {
    it('should execute handler only once', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler = vi.fn()
      
      bus.once('stringEvent', handler)
      
      bus.emit('stringEvent', 'first')
      bus.emit('stringEvent', 'second')
      
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('first')
    })

    it('should return subscription that can be manually unsubscribed', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler = vi.fn()
      
      const subscription = bus.once('stringEvent', handler)
      subscription.unsubscribe()
      
      bus.emit('stringEvent', 'test')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('State Management', () => {
    it('should return all current state', () => {
      const bus = new ServiceEventBus<TestEvents>()
      
      bus.emit('stringEvent', 'test')
      bus.emit('numberEvent', 42)
      bus.emit('objectEvent', { id: 1, name: 'test' })
      
      const state = bus.getState()
      
      expect(state).toEqual({
        stringEvent: 'test',
        numberEvent: 42,
        objectEvent: { id: 1, name: 'test' }
      })
    })

    it('should return empty object when no events emitted', () => {
      const bus = new ServiceEventBus<TestEvents>()
      
      expect(bus.getState()).toEqual({})
    })
  })

  describe('Listener Introspection', () => {
    it('should report if event has listeners', () => {
      const bus = new ServiceEventBus<TestEvents>()
      
      expect(bus.hasListeners('stringEvent')).toBe(false)
      
      bus.on('stringEvent', vi.fn())
      expect(bus.hasListeners('stringEvent')).toBe(true)
    })

    it('should return correct listener count', () => {
      const bus = new ServiceEventBus<TestEvents>()
      
      expect(bus.getListenerCount('stringEvent')).toBe(0)
      
      bus.on('stringEvent', vi.fn())
      bus.on('stringEvent', vi.fn())
      
      expect(bus.getListenerCount('stringEvent')).toBe(2)
    })

    it('should update listener count after unsubscribe', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler = vi.fn()
      
      const subscription = bus.on('stringEvent', handler)
      expect(bus.getListenerCount('stringEvent')).toBe(1)
      
      subscription.unsubscribe()
      expect(bus.getListenerCount('stringEvent')).toBe(0)
    })
  })

  describe('Cleanup Operations', () => {
    it('should remove all listeners for specific event', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handler3 = vi.fn()
      
      bus.on('stringEvent', handler1)
      bus.on('stringEvent', handler2)
      bus.on('numberEvent', handler3)
      
      bus.removeAllListeners('stringEvent')
      
      bus.emit('stringEvent', 'test')
      bus.emit('numberEvent', 42)
      
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
      expect(handler3).toHaveBeenCalledWith(42)
    })

    it('should remove all listeners for all events when no event specified', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      bus.on('stringEvent', handler1)
      bus.on('numberEvent', handler2)
      
      bus.removeAllListeners()
      
      bus.emit('stringEvent', 'test')
      bus.emit('numberEvent', 42)
      
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('should clear all state and listeners', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler = vi.fn()
      
      bus.on('stringEvent', handler)
      bus.emit('stringEvent', 'test')
      
      expect(bus.get('stringEvent')).toBe('test')
      expect(bus.hasListeners('stringEvent')).toBe(true)
      expect(handler).toHaveBeenCalledWith('test')
      
      bus.clear()
      
      expect(bus.get('stringEvent')).toBeUndefined()
      expect(bus.hasListeners('stringEvent')).toBe(false)
      
      // Reset the mock to check that it's not called after clear
      handler.mockClear()
      
      bus.emit('stringEvent', 'new test')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('Type Safety', () => {
    it('should handle complex object events', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const handler = vi.fn()
      const testObject = { id: 1, name: 'test' }
      
      bus.on('objectEvent', handler)
      bus.emit('objectEvent', testObject)
      
      expect(handler).toHaveBeenCalledWith(testObject)
      expect(bus.get('objectEvent')).toEqual(testObject)
    })

    it('should handle different event types independently', () => {
      const bus = new ServiceEventBus<TestEvents>()
      const stringHandler = vi.fn()
      const numberHandler = vi.fn()
      const objectHandler = vi.fn()
      
      bus.on('stringEvent', stringHandler)
      bus.on('numberEvent', numberHandler)
      bus.on('objectEvent', objectHandler)
      
      bus.emit('stringEvent', 'test')
      bus.emit('numberEvent', 42)
      bus.emit('objectEvent', { id: 1, name: 'test' })
      
      expect(stringHandler).toHaveBeenCalledWith('test')
      expect(numberHandler).toHaveBeenCalledWith(42)
      expect(objectHandler).toHaveBeenCalledWith({ id: 1, name: 'test' })
    })
  })
})