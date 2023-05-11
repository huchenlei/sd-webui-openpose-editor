<template>
    <a-collapse-panel>
        <template #header>
            <VisibleSwitch v-model:visible="object.visible" @update:visible="onVisibleChange" />
            <GroupSwitch v-model:grouped="object.grouped" />
            <span :class="{ hidden: !object.visible }">{{ display_name }}</span>
            <close-outlined @click="removeObject" class="close-icon" />
        </template>
        <slot name="extra-control"></slot>
        <a-list size="small">
            <a-list-item v-for="keypoint in object.keypoints" :key="keypoint.id">
                <VisibleSwitch v-model:visible="keypoint._visible" @update:visible="onVisibleChange" />
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
import GroupSwitch from './GroupSwitch.vue';
import { CloseOutlined } from '@ant-design/icons-vue';

export default {
    props: {
        object: {
            type: OpenposeObject,
            required: true,
        },
        display_name: {
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
            let all_invisible = true;
            for (const keypoint of this.object.keypoints) {
                if (keypoint._visible) all_invisible = false;
                keypoint._visible &&= visible;
            }

            // Only when all keypoints invisible, we want to turn the them
            // all to visible.
            if (visible && all_invisible) {
                this.object.keypoints.forEach(p => p._visible = true);
            }
        },
        removeObject() {
            this.$emit("removeObject", this.object);
        },
        onVisibleChange(visible: boolean) {
            // Handle the visibility change for the object
            this.$emit('update:visible', visible);
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
        GroupSwitch,
        CloseOutlined,
    }
};
</script>

