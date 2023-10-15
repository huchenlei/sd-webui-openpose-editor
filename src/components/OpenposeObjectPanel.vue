<template>
    <a-collapse-panel>
        <template #header>
            <VisibleSwitch v-model:visible="object.visible" @update:visible="onVisibleChange" />
            <GroupSwitch v-model:grouped="object.grouped" />
            <LockSwitch v-model:locked="object.locked" />
            <FlipOutlined v-if="object.flippable" @click.stop="flipObject" :title="$t('ui.flip')" :class="{ flipDisabled }">
            </FlipOutlined>
            <span :class="{ hidden: !object.visible }">{{ display_name }}</span>
            <fire-outlined @click.stop="unjamInvalidKeypoints" v-if="object.hasInvalidKeypoints()"
                title="Move all invalid keypoints to visible canvas for edit." class="unjam-button" />
            <close-outlined @click="removeObject" class="close-icon" />
        </template>
        <slot name="extra-control"></slot>
        <a-list size="small">
            <a-list-item v-for="keypoint in object.keypoints" :key="keypoint.id"
                :class="{ 'keypoint-selected': keypoint.selected }">
                <VisibleSwitch v-model:visible="keypoint._visible" @update:visible="onVisibleChange" />
                <span :class="{ hidden: !keypoint._visible }">{{ keypoint.name }}</span>
                <a-space class="coords-group">
                    <a-input-number :value="keypoint.x" @change="onKeypointXChange($event, keypoint)" addon-before="x"
                        :disabled="keypoint.selected_in_group" :precision="2" />
                    <a-input-number :value="keypoint.y" @change="onKeypointYChange($event, keypoint)" addon-before="y"
                        :disabled="keypoint.selected_in_group" :precision="2" />
                </a-space>
            </a-list-item>
        </a-list>
    </a-collapse-panel>
</template>

<script lang="ts">
import { OpenposeKeypoint2D, OpenposeObject } from '../Openpose';
import VisibleSwitch from './VisibleSwitch.vue';
import LockSwitch from './LockSwitch.vue';
import GroupSwitch from './GroupSwitch.vue';
import FlipOutlined from './FlipOutlined.vue';
import { CloseOutlined, FireOutlined } from '@ant-design/icons-vue';
import { fabric } from 'fabric';
import _ from 'lodash';
import { message } from 'ant-design-vue';
import { toRaw } from 'vue';

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

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
    computed: {
        flipDisabled() {
            return this.object.grouped || !this.object.visible || this.object.locked;
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
            if (this.object.grouped) {
                this.object.group!.set({
                    visible: visible
                });
            }
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
            this.$nextTick(() => {
                // Now, call renderAll() after the visibility updates are done
                this.object.canvas?.renderAll();
            });
        },
        onCoordsChange(keypoint: OpenposeKeypoint2D) {
            keypoint.updateConnections(IDENTITY_MATRIX);
            keypoint.setCoords();
            keypoint.canvas?.renderAll();
        },
        onKeypointXChange(x: number, keypoint: OpenposeKeypoint2D) {
            keypoint.x = x;
            this.onCoordsChange(keypoint);
        },
        onKeypointYChange(y: number, keypoint: OpenposeKeypoint2D) {
            keypoint.y = y;
            this.onCoordsChange(keypoint);
        },
        /**
         * Move all invalid keypoints to visible canvas for edit.
         */
        unjamInvalidKeypoints() {
            const canvasWidth = this.object.canvas!.width!;
            const canvasHeight = this.object.canvas!.height!;

            this.object.grouped = false;

            let xOffset = 10;
            let yOffset = 10;
            const OFFSET_STEP = Math.min(canvasHeight, canvasWidth) / 10;

            console.log(this.object.invalidKeypoints());

            this.object.invalidKeypoints().forEach((keypoint) => {
                keypoint.x = xOffset;
                keypoint.y = yOffset;

                // Increase the offset for the next invalid point
                if (xOffset + OFFSET_STEP > canvasWidth) {
                    yOffset += OFFSET_STEP;
                    xOffset = 0;
                } else {
                    xOffset += OFFSET_STEP;
                }

                keypoint._visible = true;
                this.onCoordsChange(keypoint);
            });

            this.object.canvas?.renderAll();
        },
        flipObject() {
            function isKeypointInActiveSelection(keypoint: OpenposeKeypoint2D): boolean {
                if (!keypoint.canvas) {
                    return false;
                }
                let activeObject = keypoint.canvas.getActiveObject();
                if (activeObject instanceof fabric.ActiveSelection) {
                    return activeObject.contains(toRaw(keypoint));
                }
                return false;
            }

            if (this.flipDisabled || _.some(this.object.keypoints,
                keypoint => isKeypointInActiveSelection(keypoint))) {
                message.warn('Cannot flip when object is grouped or selected');
                return;
            }

            this.object.flip();
            this.object.canvas?.renderAll();
        },
    },
    components: {
        VisibleSwitch,
        GroupSwitch,
        LockSwitch,
        CloseOutlined,
        FireOutlined,
        FlipOutlined,
    }
};
</script>

<style scoped>
.flipDisabled {
    opacity: 50%;
}
</style>
