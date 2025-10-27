/**
 * Storage service to handle API keys in both Chrome extension storage and local env
 */

// Constants
export const STORAGE_KEYS = {
  AZURE_OPENAI_KEY: 'azure_openai_key',
  DEEPSEEK_API_KEY: 'deepseek_api_key',
  GEMINI_API_KEY: 'gemini_api_key',
  // Google Drive keys
  GOOGLE_DRIVE_CONNECTED: 'google_drive_connected',
  GOOGLE_DRIVE_FOLDER_ID: 'google_drive_folder_id',
  GOOGLE_DRIVE_SYNC_ENABLED: 'google_drive_sync_enabled',
  GOOGLE_DRIVE_LAST_SYNC: 'google_drive_last_sync',
  // Summary mapping keys
  SUMMARY_FOLDER_MAPPINGS: 'summary_folder_mappings', // { url: { main: 'Education', sub: 'Programming', folderId: '...' }}
  SUMMARY_FILE_MAPPINGS: 'summary_file_mappings',      // { url: fileId } for update tracking
  SUMMARY_UPLOAD_STATUS: 'summary_upload_status'       // { url: { uploadedAt: timestamp, lastUpdatedAt: timestamp }}
};

// Map storage keys to environment variable names
const ENV_MAP = {
  [STORAGE_KEYS.AZURE_OPENAI_KEY]: 'VITE_AZURE_OPENAI_KEY',
  [STORAGE_KEYS.DEEPSEEK_API_KEY]: 'VITE_DEEPSEEK_API_KEY',
  [STORAGE_KEYS.GEMINI_API_KEY]: 'VITE_GEMINI_API_KEY'
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
export async function getStoredValue(key, envFallback) {
  // Detect if we're in extension mode with working APIs
  const extensionMode = isExtensionMode();
  
  if (extensionMode) {
    try {
      // Use the safe execution helper to automatically retry if needed
      return await safeExecuteChromeAPI(() => {
        return new Promise((resolve, reject) => {
          // Set a timeout in case the Chrome API hangs
          const timeoutId = setTimeout(() => {
            reject(new Error('Chrome storage API timeout after 3000ms'));
          }, 3000);
          
          chrome.storage.sync.get(key, (result) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              console.error(`Error getting ${key} from Chrome storage:`, chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              console.log(`Successfully retrieved value for key: ${key} from Chrome storage`);
              resolve(result[key]);
            }
          });
        });
      });
    } catch (error) {
      console.error(`Error getting ${key} from Chrome storage after retries:`, error);
      
      // If we're using Chrome storage but it failed, try localStorage as fallback
      console.warn(`Falling back to localStorage for key: ${key}`);
      const devStorage = getDevStorage();
      const value = devStorage[key];
      
      // If still not found and we have an env fallback, use that
      if (value === undefined && envFallback) {
        console.log(`Using environment variable ${envFallback} as fallback for key: ${key}`);
        return getEnvVar(envFallback);
      }
      
      return value !== undefined ? value : null;
    }
  } else {
    // In development mode, check localStorage first
    const devStorage = getDevStorage();
    const value = devStorage[key];
    
    // If the value is not found in localStorage, try to get it from environment variables
    if (value === undefined && envFallback) {
      console.log(`Using environment variable ${envFallback} as fallback for key: ${key}`);
      return getEnvVar(envFallback);
    }
    
    return value !== undefined ? value : null;
  }
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
export async function storeValue(key, value) {
  // Detect if we're in extension mode with working APIs
  const extensionMode = isExtensionMode();
  
  if (extensionMode) {
    try {
      // Use the safe execution helper to automatically retry if needed
      await safeExecuteChromeAPI(() => {
        return new Promise((resolve, reject) => {
          // Set a timeout in case the Chrome API hangs
          const timeoutId = setTimeout(() => {
            reject(new Error('Chrome storage API timeout after 3000ms'));
          }, 3000);
          
          chrome.storage.sync.set({ [key]: value }, () => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              console.error('Error storing value in Chrome storage:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              console.log(`Successfully stored value for key: ${key} in Chrome storage`);
              resolve();
            }
          });
        });
      });
      
      return;
    } catch (error) {
      console.error('Failed to store value using Chrome storage API after retries:', error);
      
      // Fall back to localStorage in case of Chrome API failure
      console.warn(`Falling back to localStorage for key: ${key}`);
      const storage = getDevStorage();
      storage[key] = value;
      saveDevStorage(storage);
      
      // In development mode, don't throw the error to allow for easier testing
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        console.log('Using localStorage fallback in development mode');
        return;
      }
      
      // Re-throw the error so caller knows there was a problem
      throw new Error(`Chrome storage API failed, fell back to localStorage: ${error.message}`);
    }
  } else {
    // For development mode, store everything under a single key
    const storage = getDevStorage();
    storage[key] = value;
    saveDevStorage(storage);
    console.log(`Value for ${key} stored in localStorage (development mode)`);
    return Promise.resolve();
  }
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
export async function getApiKey(providerConfig, allowEmpty = false) {
  const mappedKey = mapProviderToStorageKey(providerConfig.name.toLowerCase());
  
  // Import secureStorage dynamically to avoid circular dependency
  let apiKey;
  try {
    const { getSecureValue } = await import('./secureStorageService.js');
    apiKey = await getSecureValue(mappedKey, providerConfig.apiKeyEnv);
  } catch (error) {
    console.warn('Secure storage not available, falling back to basic storage:', error);
    apiKey = await getStoredValue(mappedKey, providerConfig.apiKeyEnv);
  }
  
  // In development mode or if allowEmpty is true, don't throw an error for empty keys
  if (!isExtensionMode() || allowEmpty) {
    return apiKey || '';
  }
  
  if (!apiKey) {
    throw new Error(`API key not found for provider: ${providerConfig.name}. 
      Configure it in the LLM Provider settings.`);
  }
  
  return apiKey;
}

/**
 * Maps a provider name to a storage key
 * @param {string} providerName - The name of the provider (lowercase)
 * @returns {string} The storage key
 */
function mapProviderToStorageKey(providerName) {
  switch (providerName) {
    case 'openai':
      return STORAGE_KEYS.AZURE_OPENAI_KEY;
    case 'deepseek':
      return STORAGE_KEYS.DEEPSEEK_API_KEY;
    case 'gemini':
      return STORAGE_KEYS.GEMINI_API_KEY;
    default:
      return `${providerName}_api_key`;
  }
}

/**
 * Debug function to check and log storage status
 * This helps diagnose storage issues in the console
 */
export async function checkStorage() {
  const isExtension = isExtensionMode();
  const hasExtensionURL = isExtensionURL();
  
  console.log('=== Storage Status Check ===');
  console.log(`URL indicates extension mode: ${hasExtensionURL}`);
  console.log(`Chrome storage API available: ${isExtension}`);
  
  if (isExtension) {
    // List all keys in chrome storage
    console.log('Chrome storage keys:');
    chrome.storage.sync.get(null, (items) => {
      console.log(items);
    });
  }
  
  // Check localStorage
  console.log('localStorage keys:');
  const devStorage = getDevStorage();
  console.log(`xnote-api-keys:`, devStorage);
  
  // Check for old dev_ keys
  for (const key of Object.values(STORAGE_KEYS)) {
    const oldValue = localStorage.getItem(`dev_${key}`);
    if (oldValue) {
      console.log(`Found old dev_${key} in localStorage:`, oldValue);
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
  
  // Return information about the storage environment
  return {
    isExtensionURL: isExtUrl,
    extensionMode: isExtensionMode(),
    storageType: isExtensionMode() ? 'chrome.storage.sync' : 'localStorage'
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

// Automatically initialize when imported
(async function() {
  try {
    // Don't await, let it run in the background
    initializeStorage();
  } catch (e) {
    console.error('Error initializing storage service:', e);
  }
})(); 