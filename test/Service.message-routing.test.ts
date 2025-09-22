import { describe, it, expect, beforeEach } from 'vitest';
import { Service } from '../src/core/Service';


interface TestState {
  count: number
  name: string
  data: any
}

class TestService extends Service<TestState> {
  constructor() {
    super({
      count: 0,
      name: 'initial',
      data: null
    });
  }

  increment() {
    this.setState('count', this.state.count + 1);
  }

  setName(name: string) {
    this.setState('name', name);
  }

  setData(data: any) {
    this.setState('data', data);
  }

  multipleArgs(a: string, b: number, c: boolean) {
    this.setState('name', `${a}-${b}-${c}`);
  }

  complexObjectArgs(obj: { nested: { value: string } }, arr: number[]) {
    this.setState('data', { obj, arr });
  }

  returnValue() {
    return 'test-return';
  }

  throwError() {
    throw new Error('Test error');
  }
}

describe('Service Message Routing', () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
  });

  describe('Method Routing Equivalence', () => {
    it('should produce identical results via direct call and send()', () => {
      // Test simple method
      const directService = new TestService();
      const sendService = new TestService();

      directService.increment();
      sendService.send('increment', []);

      expect(directService.state.count).toBe(sendService.state.count);
      expect(directService.state.count).toBe(1);
    });

    it('should handle single argument methods identically', () => {
      const directService = new TestService();
      const sendService = new TestService();

      directService.setName('test-name');
      sendService.send('setName', ['test-name']);

      expect(directService.state.name).toBe(sendService.state.name);
      expect(directService.state.name).toBe('test-name');
    });

    it('should handle multiple arguments correctly', () => {
      const directService = new TestService();
      const sendService = new TestService();

      directService.multipleArgs('hello', 42, true);
      sendService.send('multipleArgs', ['hello', 42, true]);

      expect(directService.state.name).toBe(sendService.state.name);
      expect(directService.state.name).toBe('hello-42-true');
    });
  });

  describe('Complex Argument Handling', () => {
    it('should preserve complex object structures through message routing', () => {
      const complexObj = {
        nested: { value: 'deep-value' },
        array: [1, 2, 3],
        date: new Date('2023-01-01'),
        nullValue: null,
        undefinedValue: undefined
      };

      service.send('setData', [complexObj]);

      expect(service.state.data).toEqual(complexObj);
      expect(service.state.data.nested.value).toBe('deep-value');
      expect(service.state.data.array).toEqual([1, 2, 3]);
    });

    it('should handle nested objects and arrays as method arguments', () => {
      const nestedObj = { nested: { value: 'test-nested' } };
      const numberArray = [10, 20, 30];

      service.send('complexObjectArgs', [nestedObj, numberArray]);

      expect(service.state.data.obj).toEqual(nestedObj);
      expect(service.state.data.arr).toEqual(numberArray);
    });

    it('should preserve argument types through message layer', () => {
      // Test various data types
      service.send('setData', [42]);
      expect(service.state.data).toBe(42);

      service.send('setData', ['string']);
      expect(service.state.data).toBe('string');

      service.send('setData', [true]);
      expect(service.state.data).toBe(true);

      service.send('setData', [null]);
      expect(service.state.data).toBe(null);
    });
  });

  describe('Message Routing Reliability', () => {
    it('should route all public methods correctly', () => {
      // Get all public methods
      const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(service))
        .filter(name => {
          const method = (service as any)[name];
          return typeof method === 'function' &&
                 name !== 'constructor' &&
                 !Service.BASE_METHODS.has(name);
        });

      // Verify each public method can be called via send()
      expect(publicMethods).toContain('increment');
      expect(publicMethods).toContain('setName');
      expect(publicMethods).toContain('setData');
      expect(publicMethods).toContain('multipleArgs');

      // Test that each method can be invoked via send() without errors
      service.send('increment', []);
      service.send('setName', ['routed']);
      service.send('setData', [{ routed: true }]);

      expect(service.state.count).toBe(1);
      expect(service.state.name).toBe('routed');
      expect(service.state.data).toEqual({ routed: true });
    });

    it('should handle rapid sequential message sends', () => {
      // Send multiple messages rapidly
      service.send('increment', []);
      service.send('increment', []);
      service.send('increment', []);
      service.send('setName', ['rapid']);
      service.send('increment', []);

      expect(service.state.count).toBe(4);
      expect(service.state.name).toBe('rapid');
    });

    it('should handle interleaved state changes correctly', () => {
      const stateChanges: string[] = [];

      service.on('count', () => { stateChanges.push('count'); });
      service.on('name', () => { stateChanges.push('name'); });
      service.on('data', () => { stateChanges.push('data'); });

      service.send('increment', []);
      service.send('setName', ['test']);
      service.send('setData', [42]);
      service.send('increment', []);

      expect(stateChanges).toEqual(['count', 'name', 'data', 'count']);
      expect(service.state.count).toBe(2);
      expect(service.state.name).toBe('test');
      expect(service.state.data).toBe(42);
    });
  });

  describe('Error Handling in Message Routing', () => {
    it('should propagate method errors through message routing', () => {
      expect(() => {
        service.send('throwError', []);
      }).toThrow('Test error');
    });

    it('should handle nonexistent method gracefully', () => {
      // This should not crash the service
      service.send('nonExistentMethod' as any, []);

      // Service should still be functional
      service.send('increment', []);
      expect(service.state.count).toBe(1);
    });

    it('should continue functioning after method errors', () => {
      // Cause an error
      try {
        service.send('throwError', []);
      } catch {
        // Expected error
      }

      // Service should still work normally
      service.send('increment', []);
      service.send('setName', ['after-error']);

      expect(service.state.count).toBe(1);
      expect(service.state.name).toBe('after-error');
    });
  });

  describe('Message History Tracking', () => {
    it('should track all messages sent through routing', () => {
      service.send('increment', []);
      service.send('setName', ['tracked']);
      service.send('setData', [{ tracked: true }]);

      const history = service.getMessageHistory();
      expect(history).toHaveLength(3);

      expect(history[0].type).toBe('increment');
      expect(history[1].type).toBe('setName');
      expect(history[2].type).toBe('setData');

      expect(history[1].payload).toEqual(['tracked']);
      expect(history[2].payload).toEqual([{ tracked: true }]);
    });

    it('should provide complete message metadata', () => {
      service.send('setName', ['metadata-test']);

      const history = service.getMessageHistory();
      const message = history[0];

      expect(message).toHaveProperty('type', 'setName');
      expect(message).toHaveProperty('payload', ['metadata-test']);
      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('timestamp');
      expect(typeof message.id).toBe('string');
      expect(typeof message.timestamp).toBe('number');
    });
  });
});
