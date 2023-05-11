import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import 'ant-design-vue/dist/antd.compact.css'
import NotificationPlugin from './Notification';

import './assets/main.css'

const app = createApp(App);

app.use(createPinia())
    .use(NotificationPlugin)
    .use(Antd)
    .mount('#app');
