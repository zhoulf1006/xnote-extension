/**
 * isEncryptedFormat answers a yes/no question, so it must answer with a boolean.
 *
 * It used to return its last &&-operand — on encrypted input that is the
 * ciphertext byte array, not `true`. Every production caller happened to use it
 * in boolean context, which is exactly why the wart survived: nothing could
 * observe it until #19's closeout asserted `toBe(true)` on real encrypted data
 * and got an array back.
 *
 * The expected encrypted shape is built by hand from the format the module
 * documents (base64 of `{"iv":[…],"data":[…]}`), not by calling encrypt() —
 * an expectation produced by the code under test would move in step with it.
 */
import { describe, test, expect } from 'vitest';
import encryptionService from '../src/api/encryptionService.js';

const encryptedShaped = btoa(JSON.stringify({ iv: [1, 2, 3], data: [9, 8, 7] }));

describe('isEncryptedFormat returns a strict boolean', () => {
  test('encrypted-shaped input answers exactly true, not a truthy stand-in', () => {
    expect(encryptionService.isEncryptedFormat(encryptedShaped)).toBe(true);
  });

  test('a plain string answers exactly false', () => {
    expect(encryptionService.isEncryptedFormat('sk-plain-api-key')).toBe(false);
  });

  test('valid base64 JSON that lacks the envelope fields answers exactly false', () => {
    const wrongShape = btoa(JSON.stringify({ something: 'else' }));
    expect(encryptionService.isEncryptedFormat(wrongShape)).toBe(false);
  });

  test('empty and non-string inputs answer exactly false', () => {
    expect(encryptionService.isEncryptedFormat('')).toBe(false);
    expect(encryptionService.isEncryptedFormat(null)).toBe(false);
    expect(encryptionService.isEncryptedFormat(undefined)).toBe(false);
    expect(encryptionService.isEncryptedFormat({ iv: [1], data: [2] })).toBe(false);
  });
});
