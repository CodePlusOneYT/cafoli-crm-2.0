import { sha256 } from "@oslojs/crypto/sha2";

/**
 * Hash a password using SHA-256 with a salt
 * In production, consider using a more robust algorithm like Argon2 or bcrypt
 */
export function hashPassword(password: string): string {
  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Hash password with salt
  const passwordWithSalt = password + saltHex;
  const hash = sha256(new TextEncoder().encode(passwordWithSalt));
  const hashHex = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Return salt:hash format
  return `${saltHex}:${hashHex}`;
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [saltHex, expectedHashHex] = storedHash.split(':');
    if (!saltHex || !expectedHashHex) return false;
    
    // Hash the provided password with the stored salt
    const passwordWithSalt = password + saltHex;
    const hash = sha256(new TextEncoder().encode(passwordWithSalt));
    const hashHex = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Compare hashes
    return hashHex === expectedHashHex;
  } catch {
    return false;
  }
}
