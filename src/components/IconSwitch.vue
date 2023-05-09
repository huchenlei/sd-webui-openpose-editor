<script lang="ts">

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
};
</script>

<template>
    <div @click.stop="toggleState" class="icon-switch">
        <slot name="enable-state" v-if="state"></slot>
        <slot name="disable-state" v-else></slot>
    </div>
</template>

<style scoped>
.icon-switch {
    cursor: pointer;
}
</style>