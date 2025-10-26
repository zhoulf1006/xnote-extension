import { reactive } from 'vue';
import { v4 as uuidv4 } from 'uuid';

const state = reactive({
  favorites: []
});

// IndexedDB setup
const dbName = 'xnote-db';
const storeName = 'favorites';
let db;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
  });
};

const loadFavorites = async () => {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => {
      state.favorites = request.result;
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
};

const addFavorite = async (favorite) => {
  await initDB();
  // Check if URL already exists
  const existingIndex = state.favorites.findIndex(f => f.url === favorite.url);
  if (existingIndex !== -1) {
    // Update existing favorite
    const updatedFavorite = {
      ...state.favorites[existingIndex],
      ...favorite,
      savedAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(updatedFavorite);
      
      request.onsuccess = () => {
        state.favorites[existingIndex] = updatedFavorite;
        resolve(updatedFavorite);
      };
      request.onerror = () => reject(request.error);
    });
  }

  const newFavorite = {
    id: uuidv4(),
    ...favorite,
    savedAt: new Date().toISOString()
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(newFavorite);
    
    request.onsuccess = () => {
      state.favorites.push(newFavorite);
      resolve(newFavorite);
    };
    request.onerror = () => reject(request.error);
  });
};

const removeFavorite = async (id) => {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      state.favorites = state.favorites.filter(f => f.id !== id);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

export default function useFavoritesStore() {
  return {
    state,
    loadFavorites,
    addFavorite,
    removeFavorite
  };
} 