import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
// Bundled locally rather than fetched from a CDN: the side panel starts a fresh
// document every time it opens, and a remote stylesheet delayed the icon-only nav
// menu by as long as it took to fetch. Bundling also makes the UI work offline.
import '@fortawesome/fontawesome-free/css/all.min.css'
import './style.css'

const app = createApp(App)
app.use(createPinia())

app.mount('#app')
