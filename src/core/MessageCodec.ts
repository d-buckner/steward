import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';

/**
 * Encode message to messagepack
 */
export function encode<T>(message: T): ArrayBuffer {
  const encoded = msgpackEncode(message);
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
}

/**
 * Decode messagepack message
 */
export function decode<T>(buffer: ArrayBuffer): T {
  return msgpackDecode(new Uint8Array(buffer)) as T;
}
