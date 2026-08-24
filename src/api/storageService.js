/**
 * Storage service to handle API keys in both Chrome extension storage and local env
 * Includes secure storage functionality for sensitive data encryption
 */

import encryptionService, { EncryptionService } from './encryptionService.js'
import { chromeStorageBackend } from './storageBackend.js'

// Set once the sync-to-local migration has fully completed, so it stops re-reading and
// re-deleting four keys on every panel open — including the writes, which consume the
// hourly sync write quota for keys that no longer exist.
const SYNC_TO_LOCAL_MIGRATION_MARKER = 'storage_migration_sync_to_local_v1'

// Same purpose for the plain-text-to-encrypted migration of the sensitive keys.
const ENCRYPTION_MIGRATION_MARKER = 'storage_migration_encryption_v1'

// Set this in the panel's localStorage to make checkStorage dump the whole store:
//   localStorage.setItem('xnote-debug-storage', 'true')
const STORAGE_DEBUG_FLAG = 'xnote-debug-storage'

// Constants
export const STORAGE_KEYS = {
  OPENAI_API_KEY: 'openai_api_key',  // Official OpenAI API
  CUSTOMIZED_API_KEY: 'customized_api_key',  // Customized provider
  CUSTOMIZED_CONFIG: 'customized_config',  // Customized provider configuration
  DEEPSEEK_API_KEY: 'deepseek_api_key',
  GEMINI_API_KEY: 'gemini_api_key',
  AZURE_SPEECH_KEY: 'azure_speech_key',
  // Google Drive keys
  GOOGLE_DRIVE_CONNECTED: 'google_drive_connected',
  GOOGLE_DRIVE_FOLDER_ID: 'google_drive_folder_id',
  GOOGLE_DRIVE_SYNC_ENABLED: 'google_drive_sync_enabled',
  GOOGLE_DRIVE_LAST_SYNC: 'google_drive_last_sync',
  GOOGLE_DRIVE_PARENT_FOLDER_ID: 'google_drive_parent_folder_id',  // Custom parent folder ID
  GOOGLE_DRIVE_PARENT_FOLDER_NAME: 'google_drive_parent_folder_name', // Display name
  GOOGLE_DRIVE_USE_CUSTOM_LOCATION: 'google_drive_use_custom_location', // Boolean flag
  // Summary mapping keys
  SUMMARY_FOLDER_MAPPINGS: 'summary_folder_mappings', // { url: { main: 'Education', sub: 'Programming', folderId: '...' }}
  SUMMARY_FILE_MAPPINGS: 'summary_file_mappings',      // { url: fileId } for update tracking
  SUMMARY_UPLOAD_STATUS: 'summary_upload_status'       // { url: { uploadedAt: timestamp, lastUpdatedAt: timestamp }}
};

// Map storage keys to environment variable names
const ENV_MAP = {
  [STORAGE_KEYS.OPENAI_API_KEY]: 'VITE_OPENAI_API_KEY',
  [STORAGE_KEYS.CUSTOMIZED_API_KEY]: 'VITE_CUSTOMIZED_API_KEY',
  [STORAGE_KEYS.DEEPSEEK_API_KEY]: 'VITE_DEEPSEEK_API_KEY',
  [STORAGE_KEYS.GEMINI_API_KEY]: 'VITE_GEMINI_API_KEY',
  [STORAGE_KEYS.AZURE_SPEECH_KEY]: 'VITE_AZURE_SPEECH_KEY'
};

// The main key for storing all API keys in development mode
const DEV_STORAGE_KEY = 'xnote-api-keys';

// Flag to track if storage has been initialized
let storageInitialized = false;

/**
 * Checks if the code is running in a Chrome extension context
 * @returns {boolean} True if running as an extension, false otherwise
 */
export function isExtensionMode() {
  try {
    // Simplified check focusing only on the storage API we need
    const hasStorage = typeof chrome !== 'undefined' && 
                      chrome.storage && 
                      chrome.storage.sync;
    
    // We only really need storage for our extension functionality
    return hasStorage;
  } catch (error) {
    // If we get an error, we're not in extension mode
    console.warn('Error checking extension mode:', error);
    return false;
  }
}

/**
 * Get the environment variable value safely
 * @param {string} varName - The environment variable name
 * @returns {string|null} The value or null if not found
 */
function getEnvVar(varName) {
  try {
    return import.meta.env[varName] || null;
  } catch (e) {
    console.warn(`Environment variable ${varName} not found`);
    return null;
  }
}

/**
 * Initialize the dev storage with environment variables
 */
function initializeDevStorage() {
  if (storageInitialized || isExtensionMode()) return;
  
  try {
    // Get current storage or create empty object
    let devStorage = {};
    try {
      const existing = localStorage.getItem(DEV_STORAGE_KEY);
      if (existing) {
        devStorage = JSON.parse(existing);
      }
    } catch (e) {
      console.warn('Failed to parse existing dev storage, starting fresh', e);
    }
    
    // Populate with environment variables for any keys not already set
    let updated = false;
    for (const [storageKey, envVar] of Object.entries(ENV_MAP)) {
      if (!(storageKey in devStorage)) {
        const envValue = getEnvVar(envVar);
        if (envValue) {
          devStorage[storageKey] = envValue;
          updated = true;
        } else {
          // Initialize with empty string if env var not found
          devStorage[storageKey] = '';
          updated = true;
        }
      }
    }
    
    // Save if any updates were made
    if (updated) {
      localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(devStorage));
    }
  } catch (e) {
    console.error('Error initializing dev storage:', e);
  } finally {
    storageInitialized = true;
  }
}

/**
 * Get the development storage object
 * @returns {Object} The development storage object
 */
function getDevStorage() {
  // Initialize storage with env vars if not already done
  if (!storageInitialized && !isExtensionMode()) {
    initializeDevStorage();
  }
  
  try {
    const storageData = localStorage.getItem(DEV_STORAGE_KEY);
    return storageData ? JSON.parse(storageData) : {};
  } catch (e) {
    console.warn('Failed to parse dev storage, resetting', e);
    return {};
  }
}

/**
 * Save the development storage object
 * @param {Object} storageObj - The storage object to save
 */
function saveDevStorage(storageObj) {
  localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(storageObj));
}

/**
 * Get a value from storage
 * @param {string} key - The key to get
 * @param {string} envFallback - The environment variable name to use as fallback
 * @returns {Promise<string|null>} The stored value or null
 */
export async function getStoredValue(key, envFallback, backend = chromeStorageBackend) {
  if (backend.isAvailable()) {
    try {
      const result = await safeExecuteChromeAPI(() => backend.syncGet([key]));
      const value = result[key];
      return value !== undefined ? value : null;
    } catch (error) {
      console.error(`Error getting ${key} from Chrome storage after retries:`, error);
      console.warn(`Falling back to localStorage for key: ${key}`);
      const devStorage = getDevStorage();
      const value = devStorage[key];
      if (value === undefined && envFallback) {
        return getEnvVar(envFallback);
      }
      return value !== undefined ? value : null;
    }
  }

  const devStorage = getDevStorage();
  const value = devStorage[key];
  if (value === undefined && envFallback) {
    return getEnvVar(envFallback);
  }
  return value !== undefined ? value : null;
}

/**
 * Checks if we're running in what should be extension mode based on URL
 * @returns {boolean} True if URL indicates extension mode
 */
function isExtensionURL() {
  try {
    // More complete check for extension URL context
    return (
      typeof window !== 'undefined' && 
      window.location && 
      window.location.href && 
      (
        // Chrome extension URL pattern
        window.location.href.startsWith('chrome-extension://') ||
        // Firefox add-on URL pattern
        window.location.href.startsWith('moz-extension://') ||
        // Edge extension URL pattern
        window.location.href.startsWith('ms-browser-extension://')
      )
    );
  } catch (error) {
    console.warn('Error checking extension URL:', error);
    return false;
  }
}

/**
 * Wait for Chrome extension API to be available (with timeout)
 * @param {number} maxWaitMs - Maximum time to wait in ms
 * @returns {Promise<boolean>} True if API became available, false if timed out
 */
async function waitForChromeAPI(maxWaitMs = 5000) {
  let totalWaitMs = 0;
  const checkIntervalMs = 50;
  
  // Quick fail if chrome is completely undefined
  if (typeof chrome === 'undefined') {
    console.log('Chrome API not available - chrome is undefined');
    return false;
  }
  
  return new Promise(resolve => {
    const checkAPI = () => {
      try {
        // Simplified check focusing only on the storage API we need
        if (chrome && chrome.storage && chrome.storage.sync) {
          console.log('Chrome storage API detected');
          
          // Optional runtime check - not required for storage functionality
          const hasRuntime = chrome.runtime && (chrome.runtime.id || chrome.runtime.getManifest);
          if (hasRuntime) {
            console.log('Chrome runtime API also available');
          }
          
          resolve(true);
          return;
        }
        
        // Check if we're in extension context even if storage is not ready
        if (chrome && chrome.runtime) {
          console.log('Extension context detected, waiting for storage API');
        }
      } catch (e) {
        console.warn('Error checking Chrome API availability:', e);
      }
      
      totalWaitMs += checkIntervalMs;
      if (totalWaitMs >= maxWaitMs) {
        console.warn(`Chrome API not available after ${maxWaitMs}ms - continuing with localStorage fallback`);
        resolve(false);
        return;
      }
      
      setTimeout(checkAPI, checkIntervalMs);
    };
    
    checkAPI();
  });
}

/**
 * Store a value 
 * @param {string} key - The key to store
 * @param {string} value - The value to store
 * @returns {Promise<void>}
 */
export async function storeValue(key, value, backend = chromeStorageBackend) {
  if (backend.isAvailable()) {
    try {
      await safeExecuteChromeAPI(() => backend.syncSet({ [key]: value }));
      return;
    } catch (error) {
      console.error('Failed to store value using Chrome storage API after retries:', error);
      console.warn(`Falling back to localStorage for key: ${key}`);
      const storage = getDevStorage();
      storage[key] = value;
      saveDevStorage(storage);
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        return;
      }
      throw new Error(`Chrome storage API failed, fell back to localStorage: ${error.message}`);
    }
  }

  const storage = getDevStorage();
  storage[key] = value;
  saveDevStorage(storage);
}

/**
 * Store a value using chrome.storage.local (for large data that may exceed sync quota)
 * Falls back to localStorage in non-extension mode
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @returns {Promise<void>}
 */
export async function storeLocalValue(key, value, backend = chromeStorageBackend) {
  if (backend.isAvailable()) {
    return await backend.localSet({ [key]: value });
  }

  const storage = getDevStorage();
  storage[key] = value;
  saveDevStorage(storage);
}

/**
 * Get a value from chrome.storage.local (for large data)
 * Falls back to localStorage in non-extension mode
 * @param {string} key - Storage key
 * @returns {Promise<any>} The stored value
 */
export async function getLocalValue(key, backend = chromeStorageBackend) {
  if (backend.isAvailable()) {
    const result = await backend.localGet([key]);
    return result[key];
  }

  const storage = getDevStorage();
  return storage[key];
}

/**
 * Check if a key is configured
 * @param {string} key - The key to check
 * @param {string} envFallback - The environment variable name to use as fallback
 * @returns {Promise<boolean>} True if the key is configured
 */
export async function isKeyConfigured(key, envFallback) {
  const value = await getStoredValue(key, envFallback);
  return Boolean(value);
}

/**
 * Remove a key from storage
 * @param {string} key - The key to remove
 * @returns {Promise<void>}
 */
export async function removeStoredValue(key) {
  // Detect if we're in extension mode with working APIs
  const extensionMode = isExtensionMode();
  
  if (extensionMode) {
    try {
      return await new Promise((resolve, reject) => {
        // Set a timeout in case the Chrome API hangs
        const timeoutId = setTimeout(() => {
          reject(new Error('Chrome storage API timeout after 3000ms'));
        }, 3000);
        
        chrome.storage.sync.remove(key, () => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            console.error(`Error removing ${key} from Chrome storage:`, chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log(`Successfully removed key: ${key} from Chrome storage`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(`Error removing ${key} from Chrome storage:`, error);
      
      // Fall back to localStorage in case of Chrome API failure
      console.warn(`Falling back to localStorage for removing key: ${key}`);
      const devStorage = getDevStorage();
      delete devStorage[key];
      saveDevStorage(devStorage);
      
      // Re-throw the error so caller knows there was a problem
      throw new Error(`Chrome storage API failed, removed from localStorage: ${error.message}`);
    }
  } else {
    // For development mode, remove from localStorage
    const devStorage = getDevStorage();
    delete devStorage[key];
    saveDevStorage(devStorage);
    console.log(`Key ${key} removed from localStorage (development mode)`);
    return Promise.resolve();
  }
}

/**
 * Get the API key for a provider
 * @param {Object} providerConfig - The provider configuration
 * @param {boolean} [allowEmpty=false] - Whether to allow empty keys (for saving flow)
 * @returns {Promise<string>} The API key or empty string if allowEmpty is true
 * @throws {Error} If the API key is not configured and allowEmpty is false
 */
/**
 * Debug function to check and log storage status
 * This helps diagnose storage issues in the console
 */
export function isStorageDebugEnabled() {
  // A localStorage flag rather than a stored setting: reading a setting would itself
  // cost the storage round trip this switch exists to avoid.
  try {
    return typeof localStorage !== 'undefined' &&
      localStorage.getItem(STORAGE_DEBUG_FLAG) === 'true';
  } catch (error) {
    return false;
  }
}

export async function checkStorage(backend = chromeStorageBackend, { verbose = isStorageDebugEnabled() } = {}) {
  const isExtension = backend.isAvailable();
  const hasExtensionURL = isExtensionURL();

  console.log('=== Storage Status Check ===');
  console.log(`URL indicates extension mode: ${hasExtensionURL}`);
  console.log(`Chrome storage API available: ${isExtension}`);

  // Reading the whole store is the expensive part, and it exists only to be printed,
  // so it happens only when someone is actually looking.
  if (isExtension && verbose) {
    try {
      console.log('Chrome storage keys:');
      console.log(await backend.syncGet(null));
    } catch (error) {
      console.warn('Could not read stored keys:', error);
    }
  }

  let devStorage = {};
  if (typeof localStorage !== 'undefined') {
    devStorage = getDevStorage();
    if (verbose) {
      console.log('localStorage keys:');
      console.log(`xnote-api-keys:`, devStorage);

      for (const key of Object.values(STORAGE_KEYS)) {
        const oldValue = localStorage.getItem(`dev_${key}`);
        if (oldValue) {
          console.log(`Found old dev_${key} in localStorage:`, oldValue);
        }
      }
    }
  }

  console.log('=== End Storage Status Check ===');

  return {
    isExtensionMode: isExtension,
    hasExtensionURL: hasExtensionURL,
    devStorage: devStorage
  };
}

/**
 * Initialize the storage service
 * This should be called when the application starts
 */
export async function initializeStorage() {
  // No eager removal of the large sync keys here. It used to delete exactly the keys
  // migrateSyncToLocalStorage then reads, so the mapping data was destroyed instead of
  // moved to local storage. The migration removes them itself, after copying them, which
  // frees the same quota without losing anything — and nothing between the two writes to
  // sync, so there is no quota pressure in the gap.

  // Check if we're running in an extension context
  const isExtUrl = isExtensionURL();

  if (isExtUrl) {
    console.log('Extension URL detected, initializing Chrome storage API...');

    // Single wait with sufficient timeout
    const apiAvailable = await waitForChromeAPI(3000);
    
    if (apiAvailable) {
      console.log('✅ Chrome storage API initialized successfully');
      
      // Do a quick test operation using our safe API helper
      try {
        await safeExecuteChromeAPI(() => {
          return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Test operation timed out')), 2000);
            
            chrome.storage.sync.get('test-key', (result) => {
              clearTimeout(timeoutId);
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(result);
              }
            });
          });
        });
        
        console.log('✅ Chrome storage API verified working');
      } catch (error) {
        console.warn('⚠️ Chrome storage API test failed, will use localStorage fallback if needed:', error);
      }
    } else {
      console.warn('⚠️ Chrome storage API not available, using localStorage fallback');
    }
  } else {
    console.log('Development mode detected, using localStorage for storage');
    initializeDevStorage();
  }
  
  // Initialize secure storage
  await secureStorageService.initialize();
  console.log('✅ Secure storage initialized:', secureStorageService.encryptionEnabled);

  // Return information about the storage environment
  return {
    isExtensionURL: isExtUrl,
    extensionMode: isExtensionMode(),
    storageType: isExtensionMode() ? 'chrome.storage.sync' : 'localStorage',
    encryptionEnabled: secureStorageService.encryptionEnabled
  };
}

/**
 * Safely execute a Chrome extension API operation with retry capability
 * @param {Function} apiOperation - Function that attempts to use Chrome APIs
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delayMs - Delay between retries in ms
 * @returns {Promise<any>} - Result of the API operation
 */
async function safeExecuteChromeAPI(apiOperation, maxRetries = 2, delayMs = 250) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If not first attempt, wait before retrying
      if (attempt > 0) {
        console.log(`Retrying Chrome API operation (attempt ${attempt} of ${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      return await apiOperation();
    } catch (error) {
      lastError = error;
      console.warn(`Chrome API operation failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
    }
  }
  
  // If we get here, all attempts failed
  throw new Error(`Chrome API operation failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
}

// Initialization moved to App.vue to avoid circular dependency issues
// initializeStorage() must be called explicitly after all modules are loaded

/**
 * SecureStorageService handles encrypted storage for sensitive data like API keys.
 * Falls back to plain storage if encryption is unavailable.
 * Auto-initializes on first use if not already initialized.
 */
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

      return await storeValue(key, valueToStore)
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
      const storedValue = await getStoredValue(key, envFallback)

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
    return await removeStoredValue(key)
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
  async migrateToEncrypted(backend = chromeStorageBackend) {
    // Checked before anything else, so a completed migration costs one lookup instead
    // of a read per sensitive key on every panel open.
    if (backend.isAvailable()) {
      const marker = await backend.localGet([ENCRYPTION_MIGRATION_MARKER])
      if (marker[ENCRYPTION_MIGRATION_MARKER]) {
        return { migrated: 0, errors: [], skipped: true }
      }
    }

    if (!this.encryptionEnabled) {
      // Deliberately unmarked: encryption may become available later, and the values
      // stored plain in the meantime still need migrating when it does.
      console.log('Encryption not available, skipping migration')
      return { migrated: 0, errors: [] }
    }

    await this.initialize()

    const results = { migrated: 0, errors: [] }

    console.log('🔄 Starting migration to encrypted storage...')

    for (const [keyName, storageKey] of Object.entries(STORAGE_KEYS)) {
      if (!this.isSensitiveKey(storageKey)) continue

      try {
        const currentValue = await getStoredValue(storageKey, undefined, backend)

        if (currentValue && !encryptionService.isEncryptedFormat(currentValue)) {
          console.log(`🔄 Migrating ${keyName} to encrypted format`)
          const encryptedValue = await encryptionService.encrypt(currentValue)
          await storeValue(storageKey, encryptedValue, backend)
          results.migrated++
          console.log(`✅ Migrated ${keyName}`)
        }
      } catch (error) {
        console.error(`❌ Failed to migrate ${keyName}:`, error)
        results.errors.push({ key: keyName, error: error.message })
      }
    }

    // Only a clean run is recorded as done, so a key that failed is retried later
    if (results.errors.length === 0 && backend.isAvailable()) {
      await backend.localSet({ [ENCRYPTION_MIGRATION_MARKER]: true })
    }

    console.log(`🎉 Migration complete: ${results.migrated} keys migrated, ${results.errors.length} errors`)
    return results
  }

  /**
   * Determine if a storage key contains sensitive data that should be encrypted
   */
  isSensitiveKey(key) {
    const sensitiveKeys = [
      STORAGE_KEYS.OPENAI_API_KEY,
      STORAGE_KEYS.CUSTOMIZED_API_KEY,
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
          const encryptedValue = await getStoredValue(storageKey)
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

// Create secure storage singleton
const secureStorageService = new SecureStorageService()

// Export secure storage functions
export const storeSecureValue = (key, value) => secureStorageService.storeSecure(key, value)
export const getSecureValue = (key, envFallback) => secureStorageService.getSecure(key, envFallback)
export const removeSecureValue = (key) => secureStorageService.removeSecure(key)
export const isSecureKeyConfigured = (key, envFallback) => secureStorageService.isSecureKeyConfigured(key, envFallback)

// Export the singleton for direct access
export { secureStorageService }

/**
 * Maps a provider name to a storage key
 * @param {string} providerName - The name of the provider (lowercase)
 * @returns {string} The storage key
 */
function mapProviderToStorageKey(providerName) {
  switch (providerName) {
    case 'openai':
      return STORAGE_KEYS.OPENAI_API_KEY;
    case 'customized':
      return STORAGE_KEYS.CUSTOMIZED_API_KEY;
    case 'deepseek':
      return STORAGE_KEYS.DEEPSEEK_API_KEY;
    case 'gemini':
      return STORAGE_KEYS.GEMINI_API_KEY;
    default:
      return `${providerName}_api_key`;
  }
}

/**
 * Gets the API key for a provider
 * @param {Object} providerConfig - The provider configuration
 * @param {boolean|Object} options - If boolean, treated as allowEmpty for backward compatibility.
 *   If object, can have: { allowEmpty: boolean, throwOnMissing: boolean }
 * @returns {Promise<string|null>} The API key, empty string, or null if not found and throwOnMissing is false
 */
export async function getApiKey(providerConfig, options = {}) {
  // Handle backward compatibility: if options is a boolean, treat it as allowEmpty
  const { allowEmpty = false, throwOnMissing = false } =
    typeof options === 'boolean'
      ? { allowEmpty: options, throwOnMissing: false }
      : options;

  const mappedKey = mapProviderToStorageKey(providerConfig.name.toLowerCase());

  // Use local getSecureValue function (no import needed)
  let apiKey;
  try {
    apiKey = await getSecureValue(mappedKey, providerConfig.apiKeyEnv);
  } catch (error) {
    console.warn('Secure storage not available, falling back to basic storage:', error);
    apiKey = await getStoredValue(mappedKey, providerConfig.apiKeyEnv);
  }

  // In development mode or if allowEmpty is true, don't throw an error for empty keys
  if (!isExtensionMode() || allowEmpty) {
    return apiKey || '';
  }

  // If no API key and throwOnMissing is explicitly set, throw an error
  if (!apiKey && throwOnMissing) {
    throw new Error(`API key not found for provider: ${providerConfig.name}.
      Configure it in the LLM Provider settings.`);
  }

  // Return null for missing keys instead of throwing (lazy initialization support)
  return apiKey || null;
}

/**
 * Migrate large mapping data from chrome.storage.sync to chrome.storage.local
 * This helps avoid quota exceeded errors for growing data
 * Should be called once during app initialization
 * @returns {Promise<void>}
 */
export async function migrateSyncToLocalStorage(backend = chromeStorageBackend) {
  if (!backend.isAvailable()) {
    console.log('Migration not needed in development mode');
    return;
  }

  // Kept in local storage, not sync: the marker is per-device, which is the correct
  // scope (each device migrates its own copy), and it costs no sync write quota.
  const marker = await backend.localGet([SYNC_TO_LOCAL_MIGRATION_MARKER]);
  if (marker[SYNC_TO_LOCAL_MIGRATION_MARKER]) {
    return;
  }

  const keysToMigrate = [
    'drive_location_mappings',
    STORAGE_KEYS.SUMMARY_FOLDER_MAPPINGS,
    STORAGE_KEYS.SUMMARY_FILE_MAPPINGS,
    STORAGE_KEYS.SUMMARY_UPLOAD_STATUS
  ];

  console.log('Checking for data to migrate from sync to local storage...');

  let allKeysSettled = true;

  for (const key of keysToMigrate) {
    let syncValue;
    try {
      const result = await backend.syncGet([key]);
      syncValue = result[key];
    } catch (readError) {
      console.warn(`Could not read ${key} from sync storage:`, readError);
      // Unread is not the same as absent: leave it be and retry on a later startup
      allKeysSettled = false;
      continue;
    }

    const hasData = syncValue !== undefined && syncValue !== null &&
      (typeof syncValue === 'object' ? Object.keys(syncValue).length > 0 : Boolean(syncValue));

    if (hasData) {
      try {
        await backend.localSet({ [key]: syncValue });
        console.log(`Migrated ${key} from sync to local storage`);
      } catch (storeError) {
        // The copy failed, so the source must survive — removing it here would
        // destroy the only remaining copy and leave nothing for the retry to move.
        console.warn(`Failed to store ${key} in local storage, leaving it in sync:`, storeError);
        allKeysSettled = false;
        continue;
      }
    }

    // Safe now: either the data is copied, or there was none to copy
    try {
      await backend.syncRemove(key);
    } catch (removeError) {
      console.warn(`Could not remove ${key} from sync storage:`, removeError);
      allKeysSettled = false;
    }
  }

  if (allKeysSettled) {
    await backend.localSet({ [SYNC_TO_LOCAL_MIGRATION_MARKER]: true });
    console.log('Migration check completed');
  } else {
    console.log('Migration incomplete, will retry on a later startup');
  }
} 