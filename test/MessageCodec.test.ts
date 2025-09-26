import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { encode, decode } from '../src/core/MessageCodec';
import { Service } from '../src/core/Service';
import { WorkerServiceClient } from '../src/core/WorkerServiceClient';

describe('MessageCodec', () => {
  test('encode returns ArrayBuffer', () => {
    const result = encode({ type: 'test', data: 'hello' });
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  test('decode returns original message structure', () => {
    const message = { type: 'test', data: 'hello', id: '123' };
    const encoded = encode(message);
    const decoded = decode(encoded);
    expect(decoded).toEqual(message);
  });

  test('handles complex nested objects', () => {
    const complex = {
      type: 'complex',
      payload: [1, 2, { nested: true }],
      metadata: { timestamp: Date.now() }
    };
    const encoded = encode(complex);
    const decoded = decode(encoded);
    expect(decoded).toEqual(complex);
  });

  test('preserves type information through serialization', () => {
    interface TypedMessage { type: string; count: number; }
    const message: TypedMessage = { type: 'typed', count: 42 };
    const encoded = encode<TypedMessage>(message);
    const decoded = decode<TypedMessage>(encoded);
    expect(decoded.count).toBe(42);
    expect(typeof decoded.count).toBe('number');
  });

  test('handles null values', () => {
    const message = { type: 'nullable', value: null };
    const encoded = encode(message);
    const decoded = decode(encoded);
    expect(decoded.value).toBeNull();
  });

  test('handles arrays and primitives', () => {
    const primitives = {
      string: 'test',
      number: 42,
      boolean: true,
      array: [1, 'two', false],
      date: new Date('2023-01-01')
    };
    const encoded = encode(primitives);
    const decoded = decode(encoded);
    expect(decoded.string).toBe('test');
    expect(decoded.number).toBe(42);
    expect(decoded.boolean).toBe(true);
    expect(decoded.array).toEqual([1, 'two', false]);
    expect(decoded.date).toEqual(new Date('2023-01-01'));
  });

  test('encoded buffer has correct size characteristics', () => {
    const small = { type: 'small' };
    const large = { type: 'large', data: 'x'.repeat(1000) };

    const smallEncoded = encode(small);
    const largeEncoded = encode(large);

    expect(largeEncoded.byteLength).toBeGreaterThan(smallEncoded.byteLength);
    expect(smallEncoded.byteLength).toBeGreaterThan(0);
  });

  test('maintains data integrity with Unicode strings', () => {
    const unicode = {
      type: 'unicode',
      emoji: '🚀✨',
      chinese: '你好世界',
      arabic: 'مرحبا بالعالم'
    };
    const encoded = encode(unicode);
    const decoded = decode(encoded);
    expect(decoded).toEqual(unicode);
  });
});

describe('MessageCodec Cross-Component Compatibility', () => {
  test('Service messages are compatible with WorkerServiceClient format', () => {
    // Test typical Service state change message
    const serviceMessage = {
      type: 'STATE_CHANGE',
      key: 'count',
      value: 42
    };

    const encoded = encode(serviceMessage);
    const decoded = decode(encoded);

    // Should match WorkerResponseMessage format expected by WorkerServiceClient
    expect(decoded).toEqual({
      type: 'STATE_CHANGE',
      key: 'count',
      value: 42
    });
  });

  test('WorkerServiceClient messages are compatible with Service format', () => {
    // Test typical WorkerServiceClient method call message
    const clientMessage = {
      type: 'SERVICE_MESSAGE',
      id: 'msg-123',
      messageType: 'increment',
      payload: []
    };

    const encoded = encode(clientMessage);
    const decoded = decode(encoded);

    // Should match WorkerMessage format expected by Service
    expect(decoded).toEqual({
      type: 'SERVICE_MESSAGE',
      id: 'msg-123',
      messageType: 'increment',
      payload: []
    });
  });

  test('complex data structures survive Service to WorkerServiceClient roundtrip', () => {
    // Use Uint8Array instead of ArrayBuffer for messagepack compatibility
    const testBuffer = new Uint8Array(10);
    testBuffer[0] = 255;
    testBuffer[9] = 128;

    const complexData = {
      type: 'STATE_CHANGE',
      key: 'complex',
      value: {
        nested: { deeply: { structured: 'data' } },
        array: [1, 'two', { three: true }],
        date: new Date('2023-01-01'),
        buffer: testBuffer
      }
    };

    const encoded = encode(complexData);
    const decoded = decode(encoded);

    // Verify structure is preserved
    expect(decoded.type).toBe('STATE_CHANGE');
    expect(decoded.key).toBe('complex');
    expect(decoded.value.nested.deeply.structured).toBe('data');
    expect(decoded.value.array).toEqual([1, 'two', { three: true }]);
    expect(decoded.value.date).toEqual(new Date('2023-01-01'));

    // Verify binary data integrity (messagepack converts ArrayBufferView to Uint8Array)
    expect(decoded.value.buffer).toBeInstanceOf(Uint8Array);
    expect(decoded.value.buffer.byteLength).toBe(10);
    expect(decoded.value.buffer[0]).toBe(255);
    expect(decoded.value.buffer[9]).toBe(128);
  });
});