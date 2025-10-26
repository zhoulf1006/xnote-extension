/**
 * Secure storage service that wraps the basic storage service with encryption
 * This provides encrypted storage for sensitive data like API keys
 */

import encryptionService, { EncryptionService } from './encryptionService.js'
import { 
  storeValue as basicStoreValue, 
  getStoredValue as basicGetStoredValue,
  removeStoredValue as basicRemoveStoredValue,
  isKeyConfigured as basicIsKeyConfigured,
  STORAGE_KEYS 
} from './storageService.js'

class SecureStorageService {
  constructor() {
    this.initialized = false
    this.encryptionEnabled = false
  }

  /**
   * Initialize the secure storage service
   */
  async initialize() {
    if (this.initialized) return

    try {
      // Check if encryption is available
      this.encryptionEnabled = EncryptionService.isAvailable()
      
      if (this.encryptionEnabled) {
        // Initialize encryption
        const success = await encryptionService.initialize()
        if (!success) {
          console.warn('Encryption initialization failed, falling back to plain storage')
          this.encryptionEnabled = false
        } else {
          console.log('✅ Secure storage initialized with encryption')
        }
      } else {
        console.warn('⚠️ Web Crypto API not available, using plain storage')
      }

      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize secure storage:', error)
      this.encryptionEnabled = false
      this.initialized = true
    }
  }

  /**
   * Store a value securely (encrypted if possible)
   */
  async storeSecure(key, value) {
    await this.initialize()

    try {
      let valueToStore = value

      // Encrypt the value if encryption is enabled
      if (this.encryptionEnabled && this.isSensitiveKey(key)) {
        valueToStore = await encryptionService.encrypt(value)
        console.log(`🔒 Storing encrypted value for key: ${key}`)
      } else {
        console.log(`📝 Storing plain value for key: ${key}`)
      }

      return await basicStoreValue(key, valueToStore)
    } catch (error) {
      console.error(`Failed to store secure value for ${key}:`, error)
      throw error
    }
  }

  /**
   * Retrieve a value securely (decrypted if necessary)
   */
  async getSecure(key, envFallback) {
    await this.initialize()

    try {
      const storedValue = await basicGetStoredValue(key, envFallback)

      if (!storedValue) {
        return storedValue
      }

      // Decrypt the value if encryption is enabled and this is encrypted data
      if (this.encryptionEnabled && this.isSensitiveKey(key)) {
        const decryptedValue = await encryptionService.decrypt(storedValue)
        console.log(`🔓 Retrieved and decrypted value for key: ${key}`)
        return decryptedValue
      } else {
        console.log(`📖 Retrieved plain value for key: ${key}`)
        return storedValue
      }
    } catch (error) {
      console.error(`Failed to get secure value for ${key}:`, error)
      throw error
    }
  }

  /**
   * Remove a value securely
   */
  async removeSecure(key) {
    await this.initialize()
    return await basicRemoveStoredValue(key)
  }

  /**
   * Check if a key is configured (works with encrypted values)
   */
  async isSecureKeyConfigured(key, envFallback) {
    await this.initialize()
    
    try {
      const value = await this.getSecure(key, envFallback)
      return Boolean(value)
    } catch (error) {
      console.warn(`Error checking if key ${key} is configured:`, error)
      return false
    }
  }

  /**
   * Migrate existing plain text values to encrypted format
   */
  async migrateToEncrypted() {
    if (!this.encryptionEnabled) {
      console.log('Encryption not available, skipping migration')
      return { migrated: 0, errors: [] }
    }

    await this.initialize()
    
    const results = { migrated: 0, errors: [] }
    
    console.log('🔄 Starting migration to encrypted storage...')

    // Migrate all sensitive keys
    for (const [keyName, storageKey] of Object.entries(STORAGE_KEYS)) {
      if (!this.isSensitiveKey(storageKey)) continue

      try {
        // Get current value using basic storage
        const currentValue = await basicGetStoredValue(storageKey)
        
        if (currentValue && !encryptionService.isEncryptedFormat(currentValue)) {
          console.log(`🔄 Migrating ${keyName} to encrypted format`)
          
          // Encrypt and store
          const encryptedValue = await encryptionService.encrypt(currentValue)
          await basicStoreValue(storageKey, encryptedValue)
          
          results.migrated++
          console.log(`✅ Migrated ${keyName}`)
        }
      } catch (error) {
        console.error(`❌ Failed to migrate ${keyName}:`, error)
        results.errors.push({ key: keyName, error: error.message })
      }
    }

    console.log(`🎉 Migration complete: ${results.migrated} keys migrated, ${results.errors.length} errors`)
    return results
  }

  /**
   * Determine if a storage key contains sensitive data that should be encrypted
   */
  isSensitiveKey(key) {
    const sensitiveKeys = [
      STORAGE_KEYS.AZURE_OPENAI_KEY,
      STORAGE_KEYS.DEEPSEEK_API_KEY,
      STORAGE_KEYS.GEMINI_API_KEY,
      STORAGE_KEYS.AZURE_SPEECH_KEY
    ]
    
    return sensitiveKeys.includes(key)
  }

  /**
   * Get encryption status
   */
  getEncryptionStatus() {
    return {
      initialized: this.initialized,
      encryptionEnabled: this.encryptionEnabled,
      encryptionService: encryptionService.getStatus()
    }
  }

  /**
   * Backup all encrypted data (returns encrypted format for safety)
   */
  async backupEncryptedData() {
    await this.initialize()
    
    const backup = {}
    
    for (const [keyName, storageKey] of Object.entries(STORAGE_KEYS)) {
      if (this.isSensitiveKey(storageKey)) {
        try {
          // Get encrypted format (don't decrypt for backup)
          const encryptedValue = await basicGetStoredValue(storageKey)
          if (encryptedValue) {
            backup[keyName] = {
              key: storageKey,
              encrypted: encryptedValue,
              isEncrypted: encryptionService.isEncryptedFormat(encryptedValue)
            }
          }
        } catch (error) {
          console.warn(`Failed to backup ${keyName}:`, error)
        }
      }
    }
    
    return {
      version: 1,
      timestamp: new Date().toISOString(),
      encryption: this.getEncryptionStatus(),
      data: backup
    }
  }

  /**
   * Test encryption functionality
   */
  async testEncryption() {
    await this.initialize()
    
    if (!this.encryptionEnabled) {
      return { success: false, error: 'Encryption not available' }
    }

    try {
      const testValue = 'test-api-key-123'
      const testKey = 'test_encryption_key'
      
      // Test encryption/decryption cycle
      await this.storeSecure(testKey, testValue)
      const retrieved = await this.getSecure(testKey)
      await this.removeSecure(testKey)
      
      if (retrieved === testValue) {
        return { success: true, message: 'Encryption test passed' }
      } else {
        return { success: false, error: 'Decrypted value does not match original' }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

// Export singleton instance
export default new SecureStorageService()

// Also export individual functions for compatibility
export const storeSecureValue = (key, value) => secureStorageService.storeSecure(key, value)
export const getSecureValue = (key, envFallback) => secureStorageService.getSecure(key, envFallback)
export const removeSecureValue = (key) => secureStorageService.removeSecure(key)
export const isSecureKeyConfigured = (key, envFallback) => secureStorageService.isSecureKeyConfigured(key, envFallback)

const secureStorageService = new SecureStorageService()
export { secureStorageService }