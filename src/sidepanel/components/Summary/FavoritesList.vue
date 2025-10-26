<template>
  <div class="favorites-modal" v-if="show">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Favorites</h2>
        <button class="close-btn" @click="$emit('close')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="favorites-list">
        <table v-if="favoritesStore.state.favorites.length">
          <thead>
            <tr>
              <th>Title</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="favorite in favoritesStore.state.favorites" :key="favorite.id">
              <td>
                <button class="link-btn" @click="selectFavorite(favorite)">
                  {{ favorite.title }}
                </button>
              </td>
              <td>{{ formatDate(favorite.savedAt) }}</td>
              <td>
                <button class="action-btn" @click="removeFavorite(favorite.id)">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">
          No favorites saved yet
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import useFavoritesStore from '../../../stores/favorites';

const props = defineProps({
  show: Boolean
});

const emit = defineEmits(['close', 'select']);

const favoritesStore = useFavoritesStore();

const selectFavorite = (favorite) => {
  emit('select', favorite);
  emit('close');
};

const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(date));
};

const removeFavorite = async (id) => {
  await favoritesStore.removeFavorite(id);
};

onMounted(() => {
  favoritesStore.loadFavorites();
});
</script>

<style scoped>
.favorites-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #dee2e6;
}

.modal-header h2 {
  font-size: 14px;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  color: #6c757d;
}

.favorites-list {
  padding: 8px;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th, td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #dee2e6;
}

th {
  font-weight: 500;
  color: #495057;
}

.action-btn {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 4px;
}

.empty-state {
  text-align: center;
  color: #6c757d;
  padding: 16px;
}

.link-btn {
  background: none;
  border: none;
  color: #2196f3;
  text-decoration: none;
  cursor: pointer;
  padding: 0;
  font-size: inherit;
  text-align: left;
  width: 100%;
}

.link-btn:hover {
  text-decoration: underline;
}
</style> 