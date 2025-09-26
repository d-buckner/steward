import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { Service } from '../src/core/Service';
import { decode } from '../src/core/MessageCodec';

// Mock worker environment
const mockSelf = {
  postMessage: vi.fn(),
  onmessage: null as any
};

interface TestState {
  count: number;
  data: string;
  buffer?: Uint8Array;
}

interface TestActions {
  increment: [];
  setData: [string];
  processBuffer: [Uint8Array];
}

class TestWorkerService extends Service<TestState, TestActions> {
  constructor() {
    super({ count: 0, data: 'initial' });
  }

  increment() {
    this.setState('count', this.state.count + 1);
  }

  setData(data: string) {
    this.setState('data', data);
  }

  processBuffer(buffer: Uint8Array) {
    this.setState('buffer', buffer);
  }
}

describe('Service Worker Message Encoding', () => {
  let service: TestWorkerService;

  beforeEach(() => {
    // Mock worker environment detection
    vi.stubGlobal('self', mockSelf);
    vi.stubGlobal('WorkerGlobalScope', function() {});
    vi.stubGlobal('importScripts', vi.fn());

    mockSelf.postMessage.mockClear();
    service = new TestWorkerService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('state changes produce decodable messages', () => {
    service.increment();

    expect(mockSelf.postMessage).toHaveBeenCalledTimes(1);
    const [encodedMessage] = mockSelf.postMessage.mock.calls[0];

    // Decode the message and verify structure
    const decoded = decode(encodedMessage);
    expect(decoded).toEqual({
      type: 'STATE_CHANGE',
      key: 'count',
      value: 1
    });
  });

  test('string state changes encode correctly', () => {
    service.setData('test message');

    const [encodedMessage] = mockSelf.postMessage.mock.calls[0];
    const decoded = decode(encodedMessage);

    expect(decoded).toEqual({
      type: 'STATE_CHANGE',
      key: 'data',
      value: 'test message'
    });
  });

  test('binary data state changes preserve data integrity', () => {
    const testBuffer = new Uint8Array(50);
    testBuffer[0] = 123;
    testBuffer[49] = 200;

    service.processBuffer(testBuffer);

    const [encodedMessage] = mockSelf.postMessage.mock.calls[0];
    const decoded = decode(encodedMessage);

    expect(decoded.type).toBe('STATE_CHANGE');
    expect(decoded.key).toBe('buffer');
    expect(decoded.value).toBeInstanceOf(Uint8Array);
    expect(decoded.value.byteLength).toBe(50);
    expect(decoded.value[0]).toBe(123);
    expect(decoded.value[49]).toBe(200);
  });

  test('bulk state changes produce multiple decodable messages', () => {
    service.setStates({
      count: 42,
      data: 'bulk'
    });

    expect(mockSelf.postMessage).toHaveBeenCalledTimes(2);

    const messages = mockSelf.postMessage.mock.calls.map(([encoded]) => decode(encoded));

    // Verify both messages are properly formatted
    expect(messages).toEqual(
      expect.arrayContaining([
        { type: 'STATE_CHANGE', key: 'count', value: 42 },
        { type: 'STATE_CHANGE', key: 'data', value: 'bulk' }
      ])
    );
  });
});