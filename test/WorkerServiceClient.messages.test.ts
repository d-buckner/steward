import { describe, test, expect, vi, beforeEach } from 'vitest';
import { WorkerServiceClient } from '../src/core/WorkerServiceClient';
import { encode, decode } from '../src/core/MessageCodec';

// Mock Worker class
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor(url: string, options?: any) {
    // Mock worker constructor
  }

  // Helper to simulate worker messages
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }
}

// Mock the getWorkerOptions function
vi.mock('../src/core/WorkerDecorator', () => ({
  getWorkerOptions: () => ({ name: 'test-worker' })
}));

// Test service constructor for WorkerServiceClient
class TestService {
  static __isWorkerService = true;
}

describe('WorkerServiceClient Message Handling', () => {
  let mockWorker: MockWorker;
  let client: WorkerServiceClient;

  beforeEach(() => {
    // Mock global Worker
    globalThis.Worker = MockWorker as any;

    client = new WorkerServiceClient(TestService, { count: 0 });
    mockWorker = (client as any).worker;
  });

  test('client sends properly encoded messages to worker', () => {
    client.send('testMethod', ['arg1', 'arg2']);

    expect(mockWorker.postMessage).toHaveBeenCalledTimes(2); // INIT + method call

    // Get the method call message (second call)
    const [encodedMessage, transferable] = mockWorker.postMessage.mock.calls[1];

    // Verify it's an ArrayBuffer and has transfer list
    expect(encodedMessage).toBeInstanceOf(ArrayBuffer);
    expect(transferable).toEqual([encodedMessage]);

    // Decode and verify structure
    const decoded = decode(encodedMessage);
    expect(decoded).toMatchObject({
      type: 'SERVICE_MESSAGE',
      messageType: 'testMethod',
      payload: ['arg1', 'arg2']
    });
    expect(decoded.id).toBeDefined();
  });

  test('client handles encoded worker responses correctly', () => {
    const testResponse = {
      type: 'MESSAGE_RESPONSE',
      id: 'test-123',
      result: { success: true, data: 'response' }
    };

    const encodedResponse = encode(testResponse);
    mockWorker.simulateMessage(encodedResponse);

    // Client should decode and process the response
    // (We can't easily test the internal promise resolution without more complex mocking)
  });

  test('client handles encoded state change messages', () => {
    const stateChange = {
      type: 'STATE_CHANGE',
      key: 'count',
      value: 42
    };

    const encodedMessage = encode(stateChange);
    mockWorker.simulateMessage(encodedMessage);

    // Verify the state was updated in the client
    expect((client as any)._state.count).toBe(42);
  });

  test('client handles binary data in state changes', () => {
    const testBuffer = new Uint8Array(100);
    testBuffer[0] = 77;
    testBuffer[99] = 88;

    const stateChange = {
      type: 'STATE_CHANGE',
      key: 'buffer',
      value: testBuffer
    };

    const encodedMessage = encode(stateChange);
    mockWorker.simulateMessage(encodedMessage);

    // Verify binary data was preserved (messagepack converts to Uint8Array)
    const clientBuffer = (client as any)._state.buffer;
    expect(clientBuffer).toBeInstanceOf(Uint8Array);
    expect(clientBuffer.byteLength).toBe(100);
    expect(clientBuffer[0]).toBe(77);
    expect(clientBuffer[99]).toBe(88);
  });

  test('client request method sends encoded messages', async () => {
    const requestPromise = client.request('asyncMethod', [{ param: 'value' }], 1000);

    // Verify encoded message was sent
    expect(mockWorker.postMessage).toHaveBeenCalledTimes(2); // INIT + request

    const [encodedMessage, transferable] = mockWorker.postMessage.mock.calls[1];
    expect(encodedMessage).toBeInstanceOf(ArrayBuffer);
    expect(transferable).toEqual([encodedMessage]);

    // Decode and verify request structure
    const decoded = decode(encodedMessage);
    expect(decoded).toMatchObject({
      type: 'SERVICE_MESSAGE',
      messageType: 'asyncMethod',
      payload: [{ param: 'value' }]
    });

    // Simulate response to resolve promise
    const response = encode({
      type: 'MESSAGE_RESPONSE',
      id: decoded.id,
      result: 'async result'
    });

    mockWorker.simulateMessage(response);

    const result = await requestPromise;
    expect(result).toBe('async result');
  });

  test('initialization message is properly encoded', () => {
    // Check the INIT message that was sent during constructor
    expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);

    const [encodedMessage, transferable] = mockWorker.postMessage.mock.calls[0];
    expect(encodedMessage).toBeInstanceOf(ArrayBuffer);
    expect(transferable).toEqual([encodedMessage]);

    const decoded = decode(encodedMessage);
    expect(decoded).toMatchObject({
      type: 'INIT_SERVICE',
      serviceName: 'TestService',
      initialState: { count: 0 }
    });
  });
});