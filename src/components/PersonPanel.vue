<template>
    <a-collapse-panel>
        <template #header>
            <VisibleSwitch v-model="person.visible" @visible-change="onVisibleChange"/>
            <span :class="{ hidden: !person.visible }">{{ person.name }}</span>
            <close-outlined @click="removePerson" class="close-icon" />
        </template>

        <a-list size="small">
            <a-list-item v-for="keypoint in person.body.keypoints">
                <VisibleSwitch v-model="keypoint._visible" @visible-change="onVisibleChange"/>
                <span :class="{ hidden: !keypoint._visible }">{{ keypoint.name }}</span>
            </a-list-item>
        </a-list>
    </a-collapse-panel>
</template>

<script lang="ts">
import {OpenposePerson} from '../Openpose';
import VisibleSwitch from './VisibleSwitch.vue';
import { CloseOutlined } from '@ant-design/icons-vue';

export default {
  props: {
    person: {
      type: OpenposePerson,
      required: true,
    },
  },
  watch: {
    'person.visible': {
      handler(newValue) {
        this.updateKeypointsVisibility(newValue);
      },
      immediate: true,
    },
  },
  methods: {
    updateKeypointsVisibility(visible: boolean) {
      for (const keypoint of this.person.body.keypoints) {
        keypoint._visible = visible;
      }
      console.log("Person visibility update: " + visible);
    },
    removePerson() {
      this.$emit("removePerson", this.person);
    },
    onVisibleChange(visible: boolean) {
        // Handle the visibility change for the person
        this.$emit('visible-change', visible);
    }
  },
  components: {
    VisibleSwitch,
    CloseOutlined,
  }
};
</script>

