<template>
    <a-collapse-panel>
        <template #header>
            <VisibleSwitch v-model="object.visible" @visible-change="onVisibleChange" />
            <span :class="{ hidden: !object.visible }">{{ display_name }}</span>
            <close-outlined @click="removeObject" class="close-icon" />
        </template>
        <slot name="extra-control"></slot>
        <a-list size="small">
            <a-list-item v-for="keypoint in object.keypoints" :key="keypoint.id">
                <VisibleSwitch v-model="keypoint._visible" @visible-change="onVisibleChange" />
                <span :class="{ hidden: !keypoint._visible }">{{ keypoint.name }}</span>
                <div class="coords-group">
                    <a-input-number :value="keypoint.x" @change="onKeypointXChange($event, keypoint)" addon-before="x"
                        :disabled="keypoint.selected_in_group" />
                    <a-input-number :value="keypoint.y" @change="onKeypointYChange($event, keypoint)" addon-before="y"
                        :disabled="keypoint.selected_in_group" />
                </div>
            </a-list-item>
        </a-list>
    </a-collapse-panel>
</template>

<script lang="ts">
import { OpenposeKeypoint2D, OpenposeObject } from '../Openpose';
import VisibleSwitch from './VisibleSwitch.vue';
import { CloseOutlined } from '@ant-design/icons-vue';

export default {
    props: {
        object: {
            type: OpenposeObject,
            required: true,
        },
        display_name : {
            type: String,
            required: true,
        },
    },
    watch: {
        'object.visible': {
            handler(newValue) {
                this.updateKeypointsVisibility(newValue);
            },
            immediate: true,
        },
    },
    methods: {
        updateKeypointsVisibility(visible: boolean) {
            for (const keypoint of this.object.keypoints) {
                keypoint._visible = visible;
            }
        },
        removeObject() {
            this.$emit("removeObject", this.object);
        },
        onVisibleChange(visible: boolean) {
            // Handle the visibility change for the object
            this.$emit('visible-change', visible);
        },
        onKeypointXChange(x: number, keypoint: OpenposeKeypoint2D) {
            keypoint.x = x;
            this.$emit('keypoint-coords-change', keypoint);
        },
        onKeypointYChange(y: number, keypoint: OpenposeKeypoint2D) {
            keypoint.y = y;
            this.$emit('keypoint-coords-change', keypoint);
        },
    },
    components: {
        VisibleSwitch,
        CloseOutlined,
    }
};
</script>

