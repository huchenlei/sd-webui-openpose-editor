<template>
    <a-collapse-panel>
        <template #header>
            <VisibleSwitch v-model="person.visible" @visible-change="onVisibleChange" />
            <span :class="{ hidden: !person.visible }">{{ person.name }}</span>
            <close-outlined @click="removePerson" class="close-icon" />
        </template>

        <a-button v-if="person.left_hand === undefined">Add left hand</a-button>
        <a-button v-if="person.right_hand === undefined">Add right hand</a-button>
        <a-button v-if="person.face === undefined">Add face</a-button>

        <a-list size="small">
            <a-list-item v-for="keypoint in person.body.keypoints" :key="keypoint.id">
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
import { OpenposeKeypoint2D, OpenposePerson } from '../Openpose';
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
        },
        removePerson() {
            this.$emit("removePerson", this.person);
        },
        onVisibleChange(visible: boolean) {
            // Handle the visibility change for the person
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

