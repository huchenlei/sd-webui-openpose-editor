<script lang="ts">
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons-vue';

export default {
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },
  computed: {
    state: {
      get() {
        return this.modelValue;
      },
      set(value: boolean) {
        this.$emit('update:modelValue', value);
      },
    },
  },
  methods: {
    toggleState() {
      this.state = !this.state;
    },
  },
  components: {
    EyeOutlined, EyeInvisibleOutlined,
  }
};
</script>

<template>
    <div @click.stop="toggleState" class="visible-switch">
        <eye-outlined v-if="state" />
        <eye-invisible-outlined v-else />
    </div>
</template>

<style scoped>
.visible-switch {
    cursor: pointer;
}
</style>