import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Service } from '../src/core/Service';
import { ServiceContainer } from '../src/core/ServiceContainer';
import { createServiceToken } from '../src/core/ServiceTokens';


interface ActionTestState {
  count: number
  name: string
  error: string | null
}

class ActionTestService extends Service<ActionTestState> {
  constructor() {
    super({
      count: 0,
      name: 'initial',
      error: null
    });
  }

  increment() {
    this.setState('count', this.state.count + 1);
  }

  setName(name: string) {
    this.setState('name', name);
  }

  async asyncIncrement() {
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 1));
    this.setState('count', this.state.count + 10);
  }

  throwError() {
    throw new Error('Test action error');
  }

  reset() {
    this.setState('count', 0);
    this.setState('name', 'reset');
    this.setState('error', null);
  }
}

const ActionTestToken = createServiceToken<ActionTestService>('ActionTest');

describe('Action Fire-and-Forget Pattern', () => {
  let container: ServiceContainer;
  let client: any; // ServiceClient proxy

  beforeEach(() => {
    container = new ServiceContainer();
    container.register(ActionTestToken, ActionTestService);
    client = container.resolve(ActionTestToken); // Get ServiceClient proxy
  });

  describe('Immediate Execution', () => {
    it('should execute actions immediately without returning promises', () => {
      // Direct method call should be immediate
      const result = client.increment();

      // Should return undefined (void), not a promise
      expect(result).toBeUndefined();

      // State should be updated immediately
      expect(client.state.count).toBe(1);
    });

    it('should execute multiple actions in sequence immediately', () => {
      const startTime = Date.now();

      // Execute multiple actions
      client.increment();
      client.increment();
      client.setName('fire-and-forget');

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should execute very quickly (synchronously)
      expect(executionTime).toBeLessThan(10);

      // All changes should be applied
      expect(client.state.count).toBe(2);
      expect(client.state.name).toBe('fire-and-forget');
    });

    it('should not create promises that developers can accidentally await', () => {
      const result = client.increment();

      // Verify it's not a promise
      expect(result).not.toBeInstanceOf(Promise);
      expect(typeof result).toBe('undefined');
      expect(result?.then).toBeUndefined();
      expect(result?.catch).toBeUndefined();
    });
  });

  describe('Synchronous vs Asynchronous Method Handling', () => {
    it('should handle synchronous methods as fire-and-forget', () => {
      const beforeState = client.state.count

      ;client.increment();

      // Should update immediately
      expect(client.state.count).toBe(beforeState + 1);
    });

    it('should handle async methods as fire-and-forget', async () => {
      const beforeState = client.state.count;

      // Call async method (fire-and-forget)
      const result = client.asyncIncrement();

      // Should not return a promise
      expect(result).toBeUndefined();

      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // State should be updated after async operation
      expect(client.state.count).toBe(beforeState + 10);
    });

    it('should not block on async operations', () => {
      const startTime = Date.now()

      // Call async method
      ;client.asyncIncrement();

      const endTime = Date.now();
      const callTime = endTime - startTime;

      // Call should return immediately (not wait for async operation)
      expect(callTime).toBeLessThan(5);

      // State might not be updated yet
      // (this tests that we don't wait for the async operation)
    });
  });

  describe('Error Handling', () => {
    it('should handle action failures gracefully without exposing promises', () => {
      expect(() => {
        client.throwError();
      }).toThrow('Test action error')

      // Service should still be functional after error
      ;client.increment();
      expect(client.state.count).toBe(1);
    });

    it('should not expose promise rejection for async action errors', async () => {
      // Create service with async error method
      class AsyncErrorService extends Service<{ error: string | null }> {
        constructor() {
          super({ error: null });
        }

        async asyncError() {
          await new Promise(resolve => setTimeout(resolve, 1));
          throw new Error('Async error');
        }

        setError(error: string) {
          this.setState('error', error);
        }
      }

      const AsyncErrorToken = createServiceToken<AsyncErrorService>('AsyncError');
      container.register(AsyncErrorToken, AsyncErrorService);
      const asyncClient = container.resolve(AsyncErrorToken);

      // Should not throw synchronously or return a promise
      const result = (asyncClient as any).asyncError();
      expect(result).toBeUndefined()

      // Should still be able to call other methods
      ;(asyncClient as any).setError('test');
      expect(asyncClient.state.error).toBe('test');
    });

    it('should continue processing subsequent actions after error', () => {
      // First action that errors
      try {
        client.throwError();
      } catch {
        // Expected error
      }

      // Subsequent actions should work normally
      ;client.increment()
      ;client.setName('after-error')
      ;client.increment();

      expect(client.state.count).toBe(2);
      expect(client.state.name).toBe('after-error');
    });
  });

  describe('State Update Immediacy', () => {
    it('should update state immediately for fire-and-forget actions', () => {
      const initialCount = client.state.count

      ;client.increment();

      // State should be updated immediately, not asynchronously
      expect(client.state.count).toBe(initialCount + 1);
    });

    it('should emit events immediately for fire-and-forget actions', () => {
      const eventSpy = vi.fn();
      client.on('count', eventSpy)

      ;client.increment();

      // Event should be emitted immediately
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith(1);
    });

    it('should handle rapid sequential state changes correctly', () => {
      const events: number[] = [];
      client.on('count', (count: number) => events.push(count))

      // Rapid sequential actions
      ;client.increment() // 1
      ;client.increment() // 2
      ;client.increment() // 3
      ;client.reset()     // 0
      ;client.increment(); // 1

      expect(events).toEqual([1, 2, 3, 0, 1]);
      expect(client.state.count).toBe(1);
    });
  });

  describe('Type Safety and Developer Experience', () => {
    it('should not allow awaiting actions (type system)', () => {
      // This is more of a type-level test, but we can verify runtime behavior
      const result = client.increment();

      // Should not be awaitable
      expect(result).toBeUndefined();
      expect(typeof result?.then).toBe('undefined');
    });

    it('should provide consistent behavior across different call patterns', () => {
      // All these should behave identically
      ;client.increment();
      const result1 = client.state.count

      ;client['increment']();
      const result2 = client.state.count;

      const methodName = 'increment'
      ;client[methodName]();
      const result3 = client.state.count;

      expect(result1).toBe(1);
      expect(result2).toBe(2);
      expect(result3).toBe(3);
    });
  });

  describe('Performance Characteristics', () => {
    it('should execute actions with minimal overhead', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        ;client.increment();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should execute very quickly (fire-and-forget should be fast)
      expect(totalTime).toBeLessThan(100); // Less than 100ms for 1000 operations
      expect(client.state.count).toBe(iterations);
    });

    it('should not create memory leaks with rapid action calls', () => {
      const initialMemory = process.memoryUsage();

      // Execute many actions rapidly
      for (let i = 0; i < 10000; i++) {
        ;client.increment();
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory growth should be reasonable (not holding onto promises/callbacks)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth
      expect(client.state.count).toBe(10000);
    });
  });
});
