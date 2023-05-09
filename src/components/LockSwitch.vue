<script lang="ts">
import { LockOutlined, UnlockOutlined } from '@ant-design/icons-vue';
import IconSwitch from './IconSwitch.vue';

export default {
  props: {
    locked: {
      type: Boolean,
      required: true,
    },
  },
  components: {
    LockOutlined, UnlockOutlined, IconSwitch,
  },
};
</script>

<template>
    <div>
        <IconSwitch :model-value="locked" @update:modelValue="$emit('update:locked', $event)">
          <template #enable-state>
            <lock-outlined></lock-outlined>
          </template>
          <template #disable-state>
            <unlock-outlined></unlock-outlined>
          </template>
        </IconSwitch>
    </div>
</template>
