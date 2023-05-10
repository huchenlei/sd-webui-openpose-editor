<script lang="ts">
import { GroupOutlined, UngroupOutlined } from '@ant-design/icons-vue';
import IconSwitch from './IconSwitch.vue';

export default {
  props: {
    grouped: {
      type: Boolean,
      required: true,
    },
  },
  components: {
    GroupOutlined, UngroupOutlined, IconSwitch,
  },
};
</script>

<template>
    <div class="group-switch" title="Group/Ungroup object">
        <IconSwitch :model-value="grouped" @update:modelValue="$emit('update:grouped', $event)">
          <template #enable-state>
            <group-outlined></group-outlined>
          </template>
          <template #disable-state>
            <ungroup-outlined></ungroup-outlined>
          </template>
        </IconSwitch>
    </div>
</template>
