<script lang="ts">
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons-vue';
import IconSwitch from './IconSwitch.vue';

export default {
  props: {
    visible: {
      type: Boolean,
      required: true,
    },
  },
  components: {
    EyeOutlined, EyeInvisibleOutlined, IconSwitch,
  },
};
</script>

<template>
    <div class="visible-switch" title="Toggle visibility">
        <IconSwitch :model-value="visible" @update:modelValue="$emit('update:visible', $event)">
          <template #enable-state>
            <eye-outlined/>
          </template>
          <template #disable-state>
            <eye-invisible-outlined/>
          </template>
        </IconSwitch>
    </div>
</template>

