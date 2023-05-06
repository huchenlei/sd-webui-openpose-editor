import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import 'ant-design-vue/dist/antd.compact.css'

import './assets/main.css'

const app = createApp(App)

app.use(createPinia())

app.use(Antd).mount('#app')
