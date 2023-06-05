import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import 'ant-design-vue/dist/antd.compact.css'
import NotificationPlugin from './Notification';
import i18n from './i18n';

import './assets/main.css'

const app = createApp(App);

app.use(createPinia())
    .use(NotificationPlugin)
    .use(Antd)
    .use(i18n)
    .mount('#app');
