/**
 * Shared IndexedDB manager for xnote-extension
 * Manages database versioning and object stores to prevent version conflicts
 */

const DB_NAME = 'xnote-db';
const DB_VERSION = 2; // Current version supporting both favorites and chatHistory

let dbInstance = null;

/**
 * Get or create the shared database instance
 * @returns {Promise<IDBDatabase>} The database instance
 */
export async function getDB() {
  // Return existing instance if available
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('Database opened successfully');

      // Handle database close/error events
      dbInstance.onclose = () => {
        console.log('Database connection closed');
        dbInstance = null;
      };

      dbInstance.onerror = (event) => {
        console.error('Database error:', event);
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log(`Upgrading database from version ${event.oldVersion} to ${event.newVersion}`);

      // Create favorites store if it doesn't exist (version 1+)
      if (!db.objectStoreNames.contains('favorites')) {
        console.log('Creating favorites object store');
        db.createObjectStore('favorites', { keyPath: 'id' });
      }

      // Create chatHistory store if it doesn't exist (version 2+)
      if (!db.objectStoreNames.contains('chatHistory')) {
        console.log('Creating chatHistory object store');
        const chatStore = db.createObjectStore('chatHistory', {
          keyPath: 'id',
          autoIncrement: true
        });
        chatStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Close the database connection
 */
export function closeDB() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log('Database connection closed');
  }
}

/**
 * Delete the entire database (use with caution)
 * @returns {Promise<void>}
 */
export async function deleteDB() {
  closeDB();

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => {
      console.log('Database deleted successfully');
      resolve();
    };

    request.onerror = () => {
      console.error('Failed to delete database:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get database info
 * @returns {object} Database information
 */
export function getDBInfo() {
  return {
    name: DB_NAME,
    version: DB_VERSION,
    isConnected: dbInstance !== null
  };
}