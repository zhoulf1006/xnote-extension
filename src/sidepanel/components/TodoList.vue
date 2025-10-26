<template>
  <div class="page-container">
    <div class="header">
      <h1>Todo List</h1>
    </div>
    <div class="todo-input">
      <input 
        v-model="newTodo"
        @keyup.enter="addTodo"
        placeholder="What needs to be done?"
        type="text"
      >
      <button class="add-btn" @click="addTodo">Add</button>
    </div>

    <div class="todo-filters">
      <button 
        :class="{ active: currentFilter === 'All' }"
        @click="currentFilter = 'All'"
      >
        All({{ todos.length }})
      </button>
      <button 
        :class="{ active: currentFilter === 'Active' }"
        @click="currentFilter = 'Active'"
      >
        Active({{ activeCount }})
      </button>
      <button 
        :class="{ active: currentFilter === 'Completed' }"
        @click="currentFilter = 'Completed'"
      >
        Completed({{ completedCount }})
      </button>
    </div>

    <div class="todos-container">
      <div 
        v-for="todo in filteredTodos"
        :key="todo.id"
        class="todo-item"
        :class="{ completed: todo.completed }"
      >
        <div class="todo-content">
          <div class="checkbox-container">
            <input
              type="checkbox"
              :checked="todo.completed"
              @change="toggleTodo(todo.id)"
              class="checkbox"
            >
          </div>
          <div class="todo-text">{{ todo.text }}</div>
          <button class="delete-btn" @click="deleteTodo(todo.id)">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="todo-date">
          {{ formatDate(todo.createdAt) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import useNavigationStore from '@/stores/navigation'

const TODO_STORAGE_KEY = 'xnote-todos'
const todos = ref([])
const newTodo = ref('')
const currentFilter = ref('All')

const loadTodos = () => {
  try {
    const savedTodos = localStorage.getItem(TODO_STORAGE_KEY)
    todos.value = savedTodos ? JSON.parse(savedTodos) : []
  } catch (error) {
    console.error('Error loading todos:', error)
    todos.value = []
  }
}

const saveTodos = () => {
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos.value))
  } catch (error) {
    console.error('Error saving todos:', error)
  }
}

const addTodo = () => {
  if (!newTodo.value.trim()) return
  
  todos.value.unshift({
    id: Date.now(),
    text: newTodo.value.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
  })
  
  newTodo.value = ''
  saveTodos()
}

const deleteTodo = (id) => {
  todos.value = todos.value.filter(todo => todo.id !== id)
  saveTodos()
}

const toggleTodo = (id) => {
  todos.value = todos.value.map(todo => {
    if (todo.id === id) {
      return { ...todo, completed: !todo.completed }
    }
    return todo
  })
  saveTodos()
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const activeCount = computed(() => todos.value.filter(todo => !todo.completed).length)
const completedCount = computed(() => todos.value.filter(todo => todo.completed).length)

const filteredTodos = computed(() => {
  if (currentFilter.value === 'Active') {
    return todos.value.filter(todo => !todo.completed)
  } else if (currentFilter.value === 'Completed') {
    return todos.value.filter(todo => todo.completed)
  }
  return todos.value
})

onMounted(loadTodos)
</script>

<style scoped>
.todo-list {
  padding: 12px;
  max-width: 800px;
  margin: 0 auto;
}

.todo-input {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.todo-input input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.todo-input input::placeholder {
  color: #9e9e9e;
  font-size: 14px;
}

.add-btn {
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
}

.todo-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.todo-filters button {
  padding: 6px 12px;
  border: none;
  background: #f5f5f5;
  border-radius: 16px;
  cursor: pointer;
  color: #757575;
  font-weight: 500;
  font-size: 13px;
}

.todo-filters button.active {
  background: #2196f3;
  color: white;
}

.todo-item {
  background: white;
  border-radius: 6px;
  margin-bottom: 8px;
  border-left: 3px solid;
  overflow: hidden;
}

.todo-item:not(.completed) {
  border-left-color: #4caf50;
}

.todo-item.completed {
  border-left-color: #9e9e9e;
}

.todo-content {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
}

.checkbox-container {
  display: flex;
  align-items: center;
}

.checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.todo-text {
  flex: 1;
  font-size: 14px;
  color: #212121;
}

.completed .todo-text {
  text-decoration: line-through;
  color: #9e9e9e;
}

.delete-btn {
  padding: 6px;
  background: none;
  border: none;
  color: #e57373;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.delete-btn:hover {
  opacity: 1;
}

.todo-date {
  padding: 6px 12px;
  background: #f5f5f5;
  color: #757575;
  font-size: 12px;
}
</style>
