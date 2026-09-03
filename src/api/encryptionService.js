/**
 * Encryption service for securing API keys in storage
 * Uses Web Crypto API with AES-GCM encryption
 */

class EncryptionService {
  constructor() {
    this.isUnlocked = false
    this.encryptionKey = null
    this.saltPrefix = 'xnote-'
    
    // Derived on first use rather than here: this module exports a singleton, so
    // constructing it at import time read browser-only globals (screen, navigator)
    // and made every module that transitively imports it unimportable outside a
    // browser. The value is deterministic, so deferring it changes nothing else.
    this._masterPassword = null
  }

  /**
   * Deterministic device-specific password, derived on first access.
   * Use a deterministic password for now - in production this could be:
   * 1. User-provided master password
   * 2. Device-specific identifier
   * 3. Hardware-based key generation
   */
  get masterPassword() {
    if (this._masterPassword === null) {
      this._masterPassword = this.generateDeviceKey()
    }
    return this._masterPassword
  }

  /**
   * Generate a device-specific key for encryption
   * This creates a consistent key per device/browser
   */
  generateDeviceKey() {
    // In a real implementation, you might use:
    // - navigator.hardwareConcurrency
    // - screen dimensions
    // - timezone
    // - other browser fingerprinting techniques
    
    const factors = [
      navigator.userAgent.slice(0, 50),
      navigator.language,
      screen.width.toString(),
      screen.height.toString(),
      new Date().getTimezoneOffset().toString()
    ]
    
    return btoa(factors.join('|')).slice(0, 32)
  }

  /**
   * Derive encryption key from master password
   */
  async deriveKey(password, salt) {
    const encoder = new TextEncoder()
    
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    )
    
    // Derive actual encryption key
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  /**
   * Initialize encryption - must be called before using encryption
   */
  async initialize() {
    if (this.isUnlocked) return true
    
    try {
      const salt = this.saltPrefix + 'encryption'
      this.encryptionKey = await this.deriveKey(this.masterPassword, salt)
      this.isUnlocked = true
      return true
    } catch (error) {
      console.error('Failed to initialize encryption:', error)
      return false
    }
  }

  /**
   * Encrypt a value
   */
  async encrypt(plaintext) {
    if (!this.isUnlocked) {
      const initialized = await this.initialize()
      if (!initialized) {
        throw new Error('Encryption not available')
      }
    }

    if (!plaintext || typeof plaintext !== 'string') {
      // For empty/null values, return as-is
      return plaintext
    }

    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(plaintext)
      
      // Generate random IV for each encryption
      const iv = crypto.getRandomValues(new Uint8Array(12))
      
      // Encrypt the data
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        data
      )
      
      // Combine IV + encrypted data for storage
      const result = {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted)),
        version: 1 // For future migration support
      }
      
      // Return as base64 encoded string
      return btoa(JSON.stringify(result))
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * Decrypt a value
   */
  async decrypt(encryptedData) {
    if (!this.isUnlocked) {
      const initialized = await this.initialize()
      if (!initialized) {
        throw new Error('Encryption not available')
      }
    }

    if (!encryptedData || typeof encryptedData !== 'string') {
      // For empty/null values, return as-is
      return encryptedData
    }

    // Check if this looks like encrypted data
    if (!this.isEncryptedFormat(encryptedData)) {
      // This might be plain text stored before encryption was enabled
      return encryptedData
    }

    try {
      // Decode from base64
      const parsed = JSON.parse(atob(encryptedData))
      
      if (!parsed.iv || !parsed.data) {
        throw new Error('Invalid encrypted data format')
      }
      
      const iv = new Uint8Array(parsed.iv)
      const data = new Uint8Array(parsed.data)
      
      // Decrypt the data
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        data
      )
      
      // Convert back to string
      const decoder = new TextDecoder()
      return decoder.decode(decrypted)
    } catch (error) {
      console.error('Decryption failed:', error)
      
      // If decryption fails, this might be plain text data
      // Return original value for backward compatibility
      return encryptedData
    }
  }

  /**
   * Check if a string looks like encrypted data
   */
  isEncryptedFormat(data) {
    if (!data || typeof data !== 'string') return false
    
    try {
      // Try to parse as base64 -> JSON
      const parsed = JSON.parse(atob(data))
      // Boolean() because && yields its last operand: without it this returned the
      // ciphertext byte array for encrypted input and undefined for a wrong-shaped
      // envelope — truthiness-identical, so no if-caller could ever notice.
      return Boolean(parsed && typeof parsed === 'object' && parsed.iv && parsed.data)
    } catch {
      return false
    }
  }

  /**
   * Migrate plain text values to encrypted format
   */
  async migratePlainTextValue(value) {
    if (!value || this.isEncryptedFormat(value)) {
      return value // Already encrypted or empty
    }
    
    return await this.encrypt(value)
  }

  /**
   * Check if encryption is available in this environment
   */
  static isAvailable() {
    try {
      return (
        typeof crypto !== 'undefined' &&
        crypto.subtle &&
        typeof crypto.subtle.encrypt === 'function' &&
        typeof crypto.subtle.decrypt === 'function'
      )
    } catch {
      return false
    }
  }

  /**
   * Get encryption status information
   */
  getStatus() {
    return {
      available: EncryptionService.isAvailable(),
      unlocked: this.isUnlocked,
      method: 'AES-GCM-256'
    }
  }
}

// Export singleton instance
export default new EncryptionService()

// Also export the class for static method access
export { EncryptionService }