import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Service } from '../src/core/Service';
import { ServiceContainer } from '../src/core/ServiceContainer';
import { createServiceToken } from '../src/core/ServiceTokens';


interface CounterState {
  count: number
  multiplier: number
  name: string
  metadata: { tags: string[]; version: number }
}

class CounterService extends Service<CounterState> {
  constructor() {
    super({
      count: 0,
      multiplier: 1,
      name: 'counter',
      metadata: { tags: [], version: 1 }
    });
  }

  increment() {
    this.setState('count', this.state.count + 1);
  }

  setMultiplier(value: number) {
    this.setState('multiplier', value);
  }

  updateName(name: string) {
    this.setState('name', name);
  }

  addTag(tag: string) {
    this.setState('metadata', {
      ...this.state.metadata,
      tags: [...this.state.metadata.tags, tag]
    });
  }

  reset() {
    this.setState('count', 0);
    this.setState('multiplier', 1);
    this.setState('name', 'counter');
    this.setState('metadata', { tags: [], version: 1 });
  }

  get computedValue() {
    return this.state.count * this.state.multiplier;
  }
}

const CounterToken = createServiceToken<CounterService>('Counter');

describe('State Consistency', () => {
  let container: ServiceContainer;
  let client: any; // ServiceClient proxy

  beforeEach(() => {
    container = new ServiceContainer();
    container.register(CounterToken, CounterService);

    client = container.resolve(CounterToken);
  });

  describe('Direct Service State Consistency', () => {
    it('should maintain consistent state across direct method calls', () => {
      expect(client.state.count).toBe(0);
      expect(client.state.multiplier).toBe(1);

      client.increment();
      expect(client.state.count).toBe(1);

      client.setMultiplier(5);
      expect(client.state.multiplier).toBe(5);
      expect(client.computedValue).toBe(5);

      client.increment();
      expect(client.state.count).toBe(2);
      expect(client.computedValue).toBe(10);
    });

    it('should emit events for all state changes', () => {
      const countSpy = vi.fn();
      const multiplierSpy = vi.fn();
      const nameSpy = vi.fn();

      client.on('count', countSpy);
      client.on('multiplier', multiplierSpy);
      client.on('name', nameSpy);

      client.increment();
      client.setMultiplier(3);
      client.updateName('test-service');

      expect(countSpy).toHaveBeenCalledWith(1);
      expect(multiplierSpy).toHaveBeenCalledWith(3);
      expect(nameSpy).toHaveBeenCalledWith('test-service');
    });

    it('should handle complex nested state updates consistently', () => {
      const metadataSpy = vi.fn();
      client.on('metadata', metadataSpy);

      expect(client.state.metadata.tags).toEqual([]);

      client.addTag('tag1');
      expect(client.state.metadata.tags).toEqual(['tag1']);
      expect(metadataSpy).toHaveBeenCalledWith({ tags: ['tag1'], version: 1 });

      client.addTag('tag2');
      expect(client.state.metadata.tags).toEqual(['tag1', 'tag2']);
      expect(metadataSpy).toHaveBeenCalledWith({ tags: ['tag1', 'tag2'], version: 1 });
    });
  });

  describe('ServiceClient State Consistency', () => {
    it('should maintain state consistency between client and service', () => {
      expect(client.state.count).toBe(client.state.count);
      expect(client.state.multiplier).toBe(client.state.multiplier)

      ;(client).increment();
      expect(client.state.count).toBe(client.state.count);
      expect(client.state.count).toBe(1)

      ;(client).setMultiplier(4);
      expect(client.state.multiplier).toBe(client.state.multiplier);
      expect(client.state.multiplier).toBe(4);
    });

    it('should reflect state changes immediately through client', () => {
      const initialState = { ...client.state }

      ;(client).increment();
      expect(client.state.count).toBe(initialState.count + 1)

      ;(client).updateName('client-updated');
      expect(client.state.name).toBe('client-updated');
      expect(client.state.name).not.toBe(initialState.name);
    });

    it('should forward events from service to client', () => {
      const clientCountSpy = vi.fn();
      const clientNameSpy = vi.fn();

      client.on('count', clientCountSpy);
      client.on('name', clientNameSpy)

      ;(client).increment()
      ;(client).updateName('forwarded');

      expect(clientCountSpy).toHaveBeenCalledWith(1);
      expect(clientNameSpy).toHaveBeenCalledWith('forwarded');
    });
  });

  describe('Message Routing State Consistency', () => {
    it('should maintain state consistency across message routing patterns', () => {
      // Direct method call
      client.increment();
      const stateAfterDirect = client.state.count;

      // Message routing call
      client.send('increment', []);
      const stateAfterMessage = client.state.count;

      expect(stateAfterMessage).toBe(stateAfterDirect + 1);
      expect(stateAfterMessage).toBe(2);
    });

    it('should emit identical events for direct calls vs message routing', () => {
      const directSpy = vi.fn();
      const messageSpy = vi.fn();

      // Test direct call
      const directService = new CounterService();
      directService.on('count', directSpy);
      directService.increment();

      // Test message routing
      const messageService = new CounterService();
      messageService.on('count', messageSpy);
      messageService.send('increment', []);

      expect(directSpy).toHaveBeenCalledWith(1);
      expect(messageSpy).toHaveBeenCalledWith(1);
      expect(directSpy).toHaveBeenCalledTimes(1);
      expect(messageSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle complex state updates consistently across routing patterns', () => {
      const tag1 = 'direct-tag';
      const tag2 = 'message-tag';

      // Direct call
      client.addTag(tag1);
      expect(client.state.metadata.tags).toContain(tag1);

      // Message routing
      client.send('addTag', [tag2]);
      expect(client.state.metadata.tags).toContain(tag2);
      expect(client.state.metadata.tags).toEqual([tag1, tag2]);
    });
  });

  describe('Cross-Component State Consistency', () => {
    it('should maintain consistency across multiple clients of same service', () => {
      const client1 = container.resolve(CounterToken);
      const client2 = container.resolve(CounterToken);

      // Should be the same instance (singleton)
      expect(client1).toBe(client2)

      ;(client1).increment();
      expect(client1.state.count).toBe(client2.state.count);
      expect(client1.state.count).toBe(1)

      ;(client2).setMultiplier(3);
      expect(client1.state.multiplier).toBe(client2.state.multiplier);
      expect(client1.state.multiplier).toBe(3);
    });

    it('should synchronize events across all client instances', () => {
      const client1 = container.resolve(CounterToken);
      const client2 = container.resolve(CounterToken);

      const spy1 = vi.fn();
      const spy2 = vi.fn();

      client1.on('count', spy1);
      client2.on('count', spy2)

      ;(client1).increment();

      expect(spy1).toHaveBeenCalledWith(1);
      expect(spy2).toHaveBeenCalledWith(1);
    });

    it('should handle rapid state changes consistently across all access patterns', () => {
      const events: Array<{ source: string; value: number }> = [];

      // Track events from different sources
      client.on('count', (value: number) => events.push({ source: 'service', value }));
      client.on('count', (value: number) => events.push({ source: 'client', value }));

      // Rapid mixed updates
      client.increment()                    // direct: count = 1
      ;(client).increment();          // client: count = 2
      client.send('increment', [])         // message: count = 3
      ;(client).increment();          // client: count = 4

      expect(client.state.count).toBe(4);
      expect(client.state.count).toBe(4);

      // All events should be fired
      expect(events).toHaveLength(8); // 4 service events + 4 client events
      expect(events.filter(e => e.source === 'service')).toHaveLength(4);
      expect(events.filter(e => e.source === 'client')).toHaveLength(4);
    });
  });

  describe('State Isolation and Reset Consistency', () => {
    it('should properly isolate state changes', () => {
      const otherContainer = new ServiceContainer();
      otherContainer.register(CounterToken, CounterService);
      const otherClient = otherContainer.resolve(CounterToken)

      ;(client).increment()
      ;(client).increment();

      expect(client.state.count).toBe(2);
      expect(otherClient.state.count).toBe(0); // Different instance
    });

    it('should reset state consistently across all access patterns', () => {
      // Set up some state
      client.increment();
      client.setMultiplier(5);
      client.updateName('test');
      client.addTag('tag1');

      expect(client.state.count).toBe(1);
      expect(client.state.multiplier).toBe(5);
      expect(client.state.name).toBe('test');
      expect(client.state.metadata.tags).toEqual(['tag1']);

      // Reset through service
      client.reset();

      // Verify reset state is consistent everywhere
      expect(client.state.count).toBe(0);
      expect(client.state.multiplier).toBe(1);
      expect(client.state.name).toBe('counter');
      expect(client.state.metadata.tags).toEqual([]);

      expect(client.state.count).toBe(0);
      expect(client.state.multiplier).toBe(1);
      expect(client.state.name).toBe('counter');
      expect(client.state.metadata.tags).toEqual([]);
    });

    it('should emit reset events consistently', () => {
      const spy = vi.fn();
      client.on('count', spy);

      client.increment(); // count = 1
      client.reset();     // count = 0

      expect(spy).toHaveBeenCalledWith(1);
      expect(spy).toHaveBeenCalledWith(0);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and Memory Consistency', () => {
    it('should maintain consistent performance across access patterns', () => {
      const iterations = 100;

      // Time direct calls
      const directStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        client.increment();
      }
      const directTime = performance.now() - directStart;

      client.reset();

      // Time client calls
      const clientStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        ;(client).increment();
      }
      const clientTime = performance.now() - clientStart;

      // Both should complete in reasonable time (less than 100ms for 100 operations)
      expect(directTime).toBeLessThan(100);
      expect(clientTime).toBeLessThan(100);
      expect(client.state.count).toBe(iterations);
      expect(client.state.count).toBe(iterations);
    });

    it('should not leak memory during rapid state changes', () => {
      const eventCounts = new Map<string, number>();

      const trackEvents = (key: string) => {
        const count = eventCounts.get(key) || 0;
        eventCounts.set(key, count + 1);
      };

      client.on('count', () => trackEvents('count'));
      client.on('count', () => trackEvents('client-count'));

      // Many rapid changes
      for (let i = 0; i < 1000; i++) {
        client.increment();
      }

      expect(eventCounts.get('count')).toBe(1000);
      expect(eventCounts.get('client-count')).toBe(1000);
      expect(client.state.count).toBe(1000);
      expect(client.state.count).toBe(1000);
    });
  });
});
