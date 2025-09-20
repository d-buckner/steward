// Simple worker test to run in node
import { ServiceContainer } from './dist/steward.js';

console.log('Testing worker proxy without UI framework...');

// Simulate the DataProcessingService
class TestService {
  constructor() {
    this.state = { isProcessing: false };
  }

  async startProcessing(items, operation) {
    console.log('startProcessing called with:', items, operation);
    return 'success';
  }

  cancelProcessing() {
    console.log('cancelProcessing called');
  }

  reset() {
    console.log('reset called');
  }
}

// Add the decorator metadata manually
TestService.__isWorkerService = true;
TestService.__workerOptions = { name: 'TestWorker' };

// Create token
const TestToken = {
  symbol: Symbol('test'),
  name: 'test'
};

// Test the container
const container = new ServiceContainer();
container.register(TestToken, TestService);

console.log('Registered service');

const service = container.resolve(TestToken);
console.log('Resolved service:', service.constructor.name);

const constructor = container.getServiceConstructor(TestToken);
console.log('Constructor:', constructor?.name);

if (constructor) {
  const prototype = constructor.prototype;
  console.log('Prototype methods:', Object.getOwnPropertyNames(prototype));
}