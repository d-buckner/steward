import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Service } from '../src/core/Service';
import { ServiceContainer } from '../src/core/ServiceContainer';
import { createServiceToken } from '../src/core/ServiceTokens';


interface ProxyTestState {
  count: number
  name: string
  metadata: { version: number; tags: string[] }
  settings: { theme: string; notifications: boolean }
}

class ProxyTestService extends Service<ProxyTestState> {
  constructor() {
    super({
      count: 0,
      name: 'test-service',
      metadata: { version: 1, tags: [] },
      settings: { theme: 'light', notifications: true }
    });
  }

  increment() {
    this.setState('count', this.state.count + 1);
  }

  setName(name: string) {
    this.setState('name', name);
  }

  updateMetadata(version: number, tags: string[]) {
    this.setState('metadata', { version, tags });
  }

  toggleNotifications() {
    this.setState('settings', {
      ...this.state.settings,
      notifications: !this.state.settings.notifications
    });
  }

  getComputedValue() {
    return `${this.state.name}-${this.state.count}`;
  }

  // Method that doesn't change state
  calculateSum(a: number, b: number): number {
    return a + b;
  }

  // Property-like method
  get displayName() {
    return this.state.name.toUpperCase();
  }
}

const ProxyTestToken = createServiceToken<ProxyTestService>('ProxyTest');

describe('ServiceClient Proxy Behavior', () => {
  let container: ServiceContainer;
  let service: ProxyTestService;
  let client: any; // ServiceClient proxy with state and methods

  beforeEach(() => {
    container = new ServiceContainer();
    container.register(ProxyTestToken, ProxyTestService);

    // Get client - this wraps the service instance
    client = container.resolve(ProxyTestToken);
    // Get the actual service instance for comparison
    service = (client as any).getServiceInstance();
  });

  describe('Interface Mimicking', () => {
    it('should perfectly mimic service state interface', () => {
      // State should be identical
      expect(client.state.count).toBe(service.state.count);
      expect(client.state.name).toBe(service.state.name);
      expect(client.state.metadata).toEqual(service.state.metadata);
      expect(client.state.settings).toEqual(service.state.settings)

      // State should be reactive when modified through client
      ;(client as any).increment();
      expect(client.state.count).toBe(service.state.count);
      expect(client.state.count).toBe(1);
    });

    it('should provide identical method interfaces', () => {
      // Methods should exist on both
      expect(typeof (client as any).increment).toBe('function');
      expect(typeof (client as any).setName).toBe('function');
      expect(typeof (client as any).updateMetadata).toBe('function')

      // Methods should behave identically (fire-and-forget for client)
      ;(client as any).increment();
      expect(client.state.count).toBe(1)

      ;(client as any).increment();
      expect(client.state.count).toBe(2);
    });

    it('should handle property access identically', () => {
      // Object.keys should work on state
      const clientKeys = Object.keys(client.state);
      const serviceKeys = Object.keys(service.state);

      expect(clientKeys).toEqual(serviceKeys);
      expect(clientKeys).toContain('count');
      expect(clientKeys).toContain('name');
      expect(clientKeys).toContain('metadata');
      expect(clientKeys).toContain('settings');
    });

    it('should support property enumeration', () => {
      // for...in should work
      const clientProps: string[] = [];
      const serviceProps: string[] = [];

      for (const prop in client.state) {
        clientProps.push(prop);
      }

      for (const prop in service.state) {
        serviceProps.push(prop);
      }

      expect(clientProps).toEqual(serviceProps);
    });
  });

  describe('State Proxy Behavior', () => {
    it('should provide real-time state access', () => {
      // Initial state should match
      expect(client.state.count).toBe(0)

      // State should update through client
      ;(client as any).increment();
      expect(client.state.count).toBe(1)

      // Multiple updates
      ;(client as any).increment()
      ;(client as any).increment();
      expect(client.state.count).toBe(3);
    });

    it('should handle nested object state correctly', () => {
      const newMetadata = { version: 2, tags: ['test', 'proxy'] }

      ;(client as any).updateMetadata(2, ['test', 'proxy']);

      expect(client.state.metadata).toEqual(newMetadata);
      expect(client.state.metadata.version).toBe(2);
      expect(client.state.metadata.tags).toEqual(['test', 'proxy']);
    });

    it('should prevent direct state modification', () => {
      expect(() => {
        (client.state as any).count = 999;
      }).toThrow('Cannot redefine property: count');

      expect(() => {
        (client.state as any).name = 'hacked';
      }).toThrow('Cannot redefine property: name');

      // State should remain unchanged
      expect(client.state.count).toBe(0);
      expect(client.state.name).toBe('test-service');
    });

    it('should handle complex state updates correctly', () => {
      // Complex state change
      ;(client as any).toggleNotifications();

      expect(client.state.settings.notifications).toBe(false);
      expect(client.state.settings.theme).toBe('light') // Should preserve other properties

      // Toggle again
      ;(client as any).toggleNotifications();
      expect(client.state.settings.notifications).toBe(true);
    });
  });

  describe('Method Call Proxying', () => {
    it('should proxy method calls correctly', () => {
      const spy = vi.spyOn(service, 'send')

      ;(client as any).increment();

      expect(spy).toHaveBeenCalledWith('increment', []);
      expect(client.state.count).toBe(1);
    });

    it('should handle method calls with arguments', () => {
      const spy = vi.spyOn(service, 'send')

      ;(client as any).setName('proxied-name');

      expect(spy).toHaveBeenCalledWith('setName', ['proxied-name']);
      expect(client.state.name).toBe('proxied-name');
    });

    it('should handle methods with multiple arguments', () => {
      const spy = vi.spyOn(service, 'send')

      ;(client as any).updateMetadata(3, ['proxy', 'test']);

      expect(spy).toHaveBeenCalledWith('updateMetadata', [3, ['proxy', 'test']]);
      expect(client.state.metadata.version).toBe(3);
      expect(client.state.metadata.tags).toEqual(['proxy', 'test']);
    });

    it('should handle method calls through dynamic property access', () => {
      const methodName = 'increment'

      ;(client as any)[methodName]();

      expect(client.state.count).toBe(1);
    });
  });

  describe('Event System Proxying', () => {
    it('should forward events from service to client', () => {
      const countSpy = vi.fn();
      const nameSpy = vi.fn();

      client.on('count', countSpy);
      client.on('name', nameSpy)

      // Trigger state changes through client
      ;(client as any).increment()
      ;(client as any).setName('event-test');

      expect(countSpy).toHaveBeenCalledWith(1);
      expect(nameSpy).toHaveBeenCalledWith('event-test');
    });

    it('should support event unsubscription', () => {
      const eventSpy = vi.fn();

      const subscription = client.on('count', eventSpy)

      ;(client as any).increment();
      expect(eventSpy).toHaveBeenCalledTimes(1);

      subscription.unsubscribe()

      ;(client as any).increment();
      expect(eventSpy).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should support once listeners', () => {
      const eventSpy = vi.fn();

      client.once('count', eventSpy)

      ;(client as any).increment()
      ;(client as any).increment()
      ;(client as any).increment();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith(1);
    });

    it('should handle multiple listeners for same event', () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      const spy3 = vi.fn();

      client.on('count', spy1);
      client.on('count', spy2);
      client.on('count', spy3)

      ;(client as any).increment();

      expect(spy1).toHaveBeenCalledWith(1);
      expect(spy2).toHaveBeenCalledWith(1);
      expect(spy3).toHaveBeenCalledWith(1);
    });
  });

  describe('Property Access Behavior', () => {
    it('should handle service property access correctly', () => {
      // Base method availability check
      expect(typeof (client as any).increment).toBe('function');
      expect(typeof (client as any).setName).toBe('function');
      expect(typeof client.on).toBe('function');
      expect(typeof client.off).toBe('function');
      expect(typeof client.once).toBe('function');
    });

    it('should differentiate between methods and properties', () => {
      // State should be an object
      expect(typeof client.state).toBe('object');
      expect(client.state).not.toBeInstanceOf(Function);

      // Methods should be functions
      expect(typeof (client as any).increment).toBe('function');
      expect(typeof (client as any).setName).toBe('function');
    });

    it('should handle getters correctly', () => {
      // Access getter through client
      expect((client as any).displayName).toBe('TEST-SERVICE')

      // Update state and verify getter updates
      ;(client as any).setName('new-name');
      expect((client as any).displayName).toBe('NEW-NAME');
    });

    it('should support property checking', () => {
      // Property access should work
      expect(client.state).toBeDefined();
      expect(typeof (client as any).increment).toBe('function');
      expect(typeof (client as any).setName).toBe('function');
      expect((client as any).nonexistent).toBeUndefined();
    });
  });

  describe('Transparent Service Behavior', () => {
    it('should be indistinguishable from direct service usage', () => {
      // Developers should not know they're using a proxy

      // State access should feel natural
      const currentCount = client.state.count;
      expect(typeof currentCount).toBe('number')

      // Method calls should feel natural
      ;(client as any).increment();
      expect(client.state.count).toBe(currentCount + 1);

      // Event handling should feel natural
      let eventFired = false;
      client.on('name', () => { eventFired = true; })
      ;(client as any).setName('transparent');
      expect(eventFired).toBe(true);
    });

    it('should handle edge cases gracefully', () => {
      // Undefined property access
      expect((client as any).nonExistentProperty).toBeUndefined();

      // Null/undefined method calls (should not crash)
      try {
        (client as any).nonExistentMethod?.();
      } catch {
        // Expected - method doesn't exist
      }

      // Service should still be functional
      ;(client as any).increment();
      expect(client.state.count).toBe(1);
    });

    it('should maintain service instance identity', () => {
      // Multiple resolves should return same client
      const client2 = container.resolve(ProxyTestToken);

      // Should be same instance (singleton behavior)
      expect(client).toBe(client2)

      // State should be shared
      ;(client as any).increment();
      expect(client.state.count).toBe(client2.state.count);
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle rapid property access efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        void client.state.count; // Property access
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be fast (proxy overhead should be minimal)
      expect(duration).toBeLessThan(50); // Less than 50ms for 1000 accesses
    });

    it('should handle rapid method calls efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        ;(client as any).increment();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Less than 100ms for 1000 calls
      expect(client.state.count).toBe(iterations);
    });
  });
});
