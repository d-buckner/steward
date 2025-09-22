import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Service } from '../src/core/Service';


interface TestServiceState {
  count: number
  name: string
}

class TestService extends Service<TestServiceState> {
  constructor() {
    super({
      count: 0,
      name: 'test'
    });
  }

  increment() {
    this.setState('count', this.state.count + 1);
  }

  setName(name: string) {
    this.setState('name', name);
  }

  async asyncOperation() {
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 1));
    this.setState('count', this.state.count + 10);
  }

  throwError() {
    throw new Error('Test error');
  }

  setComplexData(data: any) {
    this.setState('count', data);
  }

  multipleArgs(a: string, b: number) {
    this.setState('name', `${a}-${b}`);
  }
}

describe('Service', () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
  });

  describe('State Management', () => {
    it('should update internal state when setState is called', () => {
      expect(service.state.count).toBe(0);

      service.increment();

      expect(service.state.count).toBe(1);
    });

    it('should emit events when setState is called', () => {
      const eventSpy = vi.fn();

      // Subscribe directly to service's eventBus
      service.on('count', eventSpy);

      service.increment();

      expect(eventSpy).toHaveBeenCalledWith(1);
    });

    it('should emit events for multiple state changes', () => {
      const countSpy = vi.fn();
      const nameSpy = vi.fn();

      service.on('count', countSpy);
      service.on('name', nameSpy);

      service.increment();
      service.setName('updated');

      expect(countSpy).toHaveBeenCalledWith(1);
      expect(nameSpy).toHaveBeenCalledWith('updated');
    });

    it('should allow unsubscribing from events', () => {
      const eventSpy = vi.fn();

      const subscription = service.on('count', eventSpy);
      service.increment();

      expect(eventSpy).toHaveBeenCalledTimes(1);

      subscription.unsubscribe();
      service.increment();

      expect(eventSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message Handling', () => {
    it('should handle messages through send() method', () => {
      expect(service.state.count).toBe(0);

      service.send('increment', []);

      expect(service.state.count).toBe(1);
    });

    it('should emit events when methods are called via send()', () => {
      const eventSpy = vi.fn();

      service.on('count', eventSpy);
      service.send('increment', []);

      expect(eventSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Message History', () => {
    it('should track message history correctly', () => {
      service.send('increment', []);
      service.send('setName', ['hello']);

      const history = service.getMessageHistory();
      expect(history).toHaveLength(2);

      expect(history[0].type).toBe('increment');
      expect(history[1].type).toBe('setName');

      // Verify message structure
      expect(history[0]).toHaveProperty('id');
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('payload');
    });

    it('should clear message history', () => {
      service.send('increment', []);
      service.send('setName', ['hello']);

      expect(service.getMessageHistory()).toHaveLength(2);

      service.clearMessageHistory();
      expect(service.getMessageHistory()).toHaveLength(0);
    });
  });

  describe('Service Lifecycle', () => {
    it('should clear all data when service is cleared', () => {
      // Set up some state and history
      service.send('increment', []);
      service.send('setName', ['test']);

      const listener = vi.fn();
      service.on('count', listener);

      expect(service.getMessageHistory()).toHaveLength(2);
      expect(service.hasListeners('count')).toBe(true);

      // Clear service
      service.clear();

      expect(service.getMessageHistory()).toHaveLength(0);
      expect(service.hasListeners('count')).toBe(false);
    });
  });

  describe('BASE_METHODS constant', () => {
    it('should contain all base service methods', () => {
      const baseMethods = Service.BASE_METHODS;

      // Core messaging methods
      expect(baseMethods.has('send')).toBe(false); // send should be exposed through ServiceClient
      expect(baseMethods.has('handle')).toBe(true);

      // State management methods
      expect(baseMethods.has('setState')).toBe(true);
      expect(baseMethods.has('getState')).toBe(true);

      // Event bus methods
      expect(baseMethods.has('on')).toBe(true);
      expect(baseMethods.has('off')).toBe(true);
      expect(baseMethods.has('emit')).toBe(true);

      // History and lifecycle methods
      expect(baseMethods.has('getMessageHistory')).toBe(true);
      expect(baseMethods.has('clearMessageHistory')).toBe(true);
      expect(baseMethods.has('clear')).toBe(true);
    });

    it('should not contain user-defined methods', () => {
      const baseMethods = Service.BASE_METHODS;

      expect(baseMethods.has('increment')).toBe(false);
      expect(baseMethods.has('setName')).toBe(false);
    });
  });
});
