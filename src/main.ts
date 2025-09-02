import './assets/main.css'

import { createApp } from 'vue'
import RootApp from './RootApp.vue'
import router from './router'

createApp(RootApp).use(router).mount('#app')
