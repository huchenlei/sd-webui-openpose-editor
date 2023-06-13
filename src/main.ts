import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import NotificationPlugin from './Notification';
import i18n from './i18n';

const urlParams = new URLSearchParams(window.location.search);
const theme = urlParams.get('theme');
if (theme === 'dark') {
  import('ant-design-vue/dist/antd.dark.css');
  document.body.classList.add('dark-theme');
} else {
  import('ant-design-vue/dist/antd.css');
}

import './assets/main.css'

const app = createApp(App);

app.use(createPinia())
    .use(NotificationPlugin)
    .use(Antd)
    .use(i18n)
    .mount('#app');
