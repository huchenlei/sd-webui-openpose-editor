import type { App } from 'vue';
import { message, notification } from 'ant-design-vue';

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $message: typeof message;
    $notify: (params: string | { title: string; desc: string; [key: string]: any }) => void;
  }
}

export default {
  install: (app: App, options?: any) => {
    app.config.globalProperties.$message = message;
    app.config.globalProperties.$notify = (params) => {
      if (typeof params === 'string') {
        notification.error({
          message: params,
        });
      } else {
        notification.error({
          message: params.title,
          description: params.desc,
          ...params,
        });
      }
    };
  },
};