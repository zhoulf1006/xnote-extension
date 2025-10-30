import { reactive } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from './dbManager';

const state = reactive({
  favorites: []
});

const storeName = 'favorites';

const loadFavorites = async () => {
  const db = await getDB();
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
  const db = await getDB();
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
  const db = await getDB();
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