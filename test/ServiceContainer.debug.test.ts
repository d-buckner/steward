import { describe, it, expect, vi } from 'vitest';
import { Service, ServiceContainer, createServiceToken } from '../src/index';


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
}

const TestToken = createServiceToken<TestService>('TestService');

describe('ServiceContainer vs Direct ServiceClient', () => {
  describe('Direct Service (Control)', () => {
    it('should emit events when using service directly', () => {
      const service = new TestService();
      const eventSpy = vi.fn();

      service.on('count', eventSpy);
      service.increment();

      expect(eventSpy).toHaveBeenCalledWith(1);
    });
  });

  // Skip direct ServiceClient test - not exported

  describe('ServiceContainer (Problem)', () => {
    it('should emit events when using ServiceContainer', () => {
      const container = new ServiceContainer();
      container.register(TestToken, TestService);
      const serviceClient = container.resolve(TestToken);

      const eventSpy = vi.fn();

      serviceClient.on('count', eventSpy);
      serviceClient.increment();

      expect(eventSpy).toHaveBeenCalledWith(1);
    });

    it('should have working state proxy', () => {
      const container = new ServiceContainer();
      container.register(TestToken, TestService);
      const serviceClient = container.resolve(TestToken);

      // State proxy should work
      expect(serviceClient.state.count).toBe(0);

      // Object.keys should work
      const keys = Object.keys(serviceClient.state);
      expect(keys).toContain('count');
      expect(keys).toContain('name');
    });
  });

  describe('Event Forwarding Debugging', () => {
    it('should show what service instance the ServiceClient wraps', () => {
      const container = new ServiceContainer();
      container.register(TestToken, TestService);
      const serviceClient = container.resolve(TestToken);

      // Get the service instance for direct testing
      const serviceInstance = (serviceClient as any).getServiceInstance();

      // Test direct event emission
      const eventSpy = vi.fn();
      serviceInstance.on('count', eventSpy);
      serviceInstance.increment();

      expect(eventSpy).toHaveBeenCalledWith(1);
    });
  });
});
