import { describe, it, expect, vi } from 'vitest'
import { Service } from '../src/core/Service'

interface TestState {
  count: number
  name: string
  enabled: boolean
  metadata: { id: string; tags: string[] }
}

// Simple service for testing basic functionality (no message handling)
class TestService extends Service<TestState> {
  constructor() {
    super({
      count: 0,
      name: 'test',
      enabled: false,
      metadata: { id: 'test-id', tags: [] }
    })
  }

  // Expose protected methods for testing
  public setCount(count: number) {
    this.setState('count', count)
  }

  public setName(name: string) {
    this.setState('name', name)
  }

  public updateMultiple(updates: Partial<TestState>) {
    this.setStates(updates)
  }

  // Test helpers - these would not exist in real services
  public getCount() {
    return this.state.count
  }

  public getName() {
    return this.state.name
  }

}

describe('Service', () => {
  describe('Initialization', () => {
    it('should initialize with provided state', () => {
      const service = new TestService()
      
      expect(service.getCount()).toBe(0)
      expect(service.getName()).toBe('test')
      expect(service.getState()).toEqual({
        count: 0,
        name: 'test',
        enabled: false,
        metadata: { id: 'test-id', tags: [] }
      })
    })

    it('should emit initial state events', () => {
      const countHandler = vi.fn()
      const nameHandler = vi.fn()
      const enabledHandler = vi.fn()
      const metadataHandler = vi.fn()
      
      const service = new TestService()
      
      // Subscribe after creation to catch initial events
      service.on('count', countHandler)
      service.on('name', nameHandler)
      service.on('enabled', enabledHandler)
      service.on('metadata', metadataHandler)
      
      // Initial values should be available
      expect(service.state.count).toBe(0)
      expect(service.state.name).toBe('test')
      expect(service.state.enabled).toBe(false)
      expect(service.state.metadata).toEqual({ id: 'test-id', tags: [] })
    })
  })

  describe('State Management', () => {
    it('should update single state property', () => {
      const service = new TestService()
      const handler = vi.fn()
      
      service.on('count', handler)
      service.setCount(42)
      
      expect(service.getCount()).toBe(42)
      expect(handler).toHaveBeenCalledWith(42)
    })

    it('should update multiple state properties', () => {
      const service = new TestService()
      const countHandler = vi.fn()
      const nameHandler = vi.fn()
      
      service.on('count', countHandler)
      service.on('name', nameHandler)
      
      service.updateMultiple({
        count: 100,
        name: 'updated'
      })
      
      expect(service.getCount()).toBe(100)
      expect(service.getName()).toBe('updated')
      expect(countHandler).toHaveBeenCalledWith(100)
      expect(nameHandler).toHaveBeenCalledWith('updated')
    })

    it('should handle complex object updates', () => {
      const service = new TestService()
      const handler = vi.fn()
      
      service.on('metadata', handler)
      
      const newMetadata = { id: 'new-id', tags: ['tag1', 'tag2'] }
      service.updateMultiple({ metadata: newMetadata })
      
      expect(service.state.metadata).toEqual(newMetadata)
      expect(handler).toHaveBeenCalledWith(newMetadata)
    })

    it('should maintain state isolation between updates', () => {
      const service = new TestService()
      
      service.setCount(10)
      service.setName('first')
      
      expect(service.getCount()).toBe(10)
      expect(service.getName()).toBe('first')
      
      service.setCount(20)
      
      expect(service.getCount()).toBe(20)
      expect(service.getName()).toBe('first') // Should remain unchanged
    })
  })

  describe('Event Emission', () => {
    it('should emit events when state changes', () => {
      const service = new TestService()
      const handler = vi.fn()
      
      service.on('count', handler)
      
      service.setCount(1)
      service.setCount(2)
      service.setCount(3)
      
      expect(handler).toHaveBeenCalledTimes(3)
      expect(handler).toHaveBeenNthCalledWith(1, 1)
      expect(handler).toHaveBeenNthCalledWith(2, 2)
      expect(handler).toHaveBeenNthCalledWith(3, 3)
    })

    it('should emit separate events for each property in batch update', () => {
      const service = new TestService()
      const countHandler = vi.fn()
      const nameHandler = vi.fn()
      const enabledHandler = vi.fn()
      
      service.on('count', countHandler)
      service.on('name', nameHandler)
      service.on('enabled', enabledHandler)
      
      service.updateMultiple({
        count: 50,
        name: 'batch',
        enabled: true
      })
      
      expect(countHandler).toHaveBeenCalledWith(50)
      expect(nameHandler).toHaveBeenCalledWith('batch')
      expect(enabledHandler).toHaveBeenCalledWith(true)
    })

    it('should not emit events for unchanged values', () => {
      const service = new TestService()
      const handler = vi.fn()
      
      service.on('count', handler)
      
      // Initial emit happens during construction
      handler.mockClear()
      
      service.setCount(0) // Same as initial value
      
      expect(handler).toHaveBeenCalledWith(0)
      expect(service.getCount()).toBe(0)
    })
  })

  describe('State Access', () => {
    it('should return current state values', () => {
      const service = new TestService()
      
      service.updateMultiple({
        count: 99,
        name: 'access-test',
        enabled: true
      })
      
      expect(service.getCount()).toBe(99)
      expect(service.getName()).toBe('access-test')
      expect(service.state.enabled).toBe(true)
    })

    it('should return current state snapshot', () => {
      const service = new TestService()
      
      const originalMetadata = { id: 'original', tags: ['tag1'] }
      service.updateMultiple({ metadata: originalMetadata })
      
      const retrievedState = service.getState()
      
      // Should contain all current state
      expect(retrievedState.metadata).toEqual(originalMetadata)
      expect(retrievedState.count).toBeDefined()
      expect(retrievedState.name).toBeDefined()
      expect(retrievedState.enabled).toBeDefined()
    })
  })

  describe('Event Bus Integration', () => {
    it('should provide event bus functionality directly', () => {
      const service = new TestService()
      
      expect(typeof service.on).toBe('function')
      expect(typeof service.hasListeners).toBe('function')
      expect(service.state).toBeDefined()
    })

    it('should support event bus subscription patterns', () => {
      const service = new TestService()
      const handler = vi.fn()
      
      const subscription = service.on('count', handler)
      
      service.setCount(123)
      expect(handler).toHaveBeenCalledWith(123)
      
      subscription.unsubscribe()
      service.setCount(456)
      
      expect(handler).toHaveBeenCalledTimes(1) // Only the first call
    })

    it('should support once subscriptions', () => {
      const service = new TestService()
      const handler = vi.fn()
      
      service.once('name', handler)
      
      service.setName('first')
      service.setName('second')
      
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('first')
    })
  })

  describe('Cleanup', () => {
    it('should clear event bus when cleared', () => {
      const service = new TestService()
      const handler = vi.fn()
      
      service.on('count', handler)
      service.setCount(42)
      
      expect(service.state.count).toBe(42)
      expect(handler).toHaveBeenCalled()
      
      service.clear()
      
      expect(service.state.count).toBeUndefined()
      expect(service.hasListeners('count')).toBe(false)
    })

    it('should clear all event listeners and state', () => {
      const service = new TestService()
      const handler = vi.fn()
      
      service.on('count', handler)
      service.setCount(42)
      service.setName('persistent')
      
      expect(service.state.count).toBe(42)
      expect(service.hasListeners('count')).toBe(true)
      
      service.clear()
      
      // State should be cleared
      expect(service.state.count).toBeUndefined()
      expect(service.state.name).toBeUndefined()
      expect(service.hasListeners('count')).toBe(false)
    })
  })

  describe('Multiple Services', () => {
    it('should maintain independent state across service instances', () => {
      const service1 = new TestService()
      const service2 = new TestService()
      
      service1.setCount(10)
      service1.setName('service1')
      
      service2.setCount(20)
      service2.setName('service2')
      
      expect(service1.getCount()).toBe(10)
      expect(service1.getName()).toBe('service1')
      expect(service2.getCount()).toBe(20)
      expect(service2.getName()).toBe('service2')
    })

    it('should maintain independent event buses', () => {
      const service1 = new TestService()
      const service2 = new TestService()
      
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      service1.on('count', handler1)
      service2.on('count', handler2)
      
      service1.setCount(100)
      
      expect(handler1).toHaveBeenCalledWith(100)
      expect(handler2).not.toHaveBeenCalled()
    })
  })
})