/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Password hashing with PBKDF2-SHA256 (Web Crypto). This only protects stored passwords from casual reading:
// with no server, the data and this code live in the same browser, so it is access control for the interface,
// not a security boundary against someone with access to the PC's browser profile.

const ITER = 150_000;
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));

export const hasCrypto = () => typeof globalThis.crypto !== 'undefined' && !!globalThis.crypto.subtle;

export function newSalt(): string {
  return b64(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const salted = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  const bits = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salted, iterations: ITER }, key, 256);
  return b64(bits);
}

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  return (await hashPassword(password, salt)) === hash;
}

/** Message if the password is not acceptable, else null. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  return null;
}
