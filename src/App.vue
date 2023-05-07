<script lang="ts">
import { defineComponent, type App, watch } from 'vue';
import { fabric } from 'fabric';
import { PlusSquareOutlined, CloseOutlined } from '@ant-design/icons-vue';
import PersonPanel from './components/PersonPanel.vue';
import {OpenposePerson, OpenposeBody, OpenposeKeypoint2D} from './Openpose';

interface AppData {
  canvasHeight: number;
  canvasWidth: number;

  personName: string;
  hideInvisibleKeypoints: boolean;
  people: OpenposePerson[];
  canvas: fabric.Canvas | null;
};

const default_keypoints: [number, number, number][] = [
  [241, 77], [241, 120], [191, 118], [177, 183],
  [163, 252], [298, 118], [317, 182], [332, 245],
  [225, 241], [213, 359], [215, 454], [270, 240],
  [282, 360], [286, 456], [232, 59], [253, 60],
  [225, 70], [260, 72]
].map(loc => [loc[0], loc[1], 1.0]);

export default defineComponent({
  data(): AppData {
    return {
      canvasHeight: 512,
      canvasWidth: 512,
      personName: '',
      hideInvisibleKeypoints: false,
      people: [
        new OpenposePerson('Example Person', new OpenposeBody(default_keypoints)),
      ],
      canvas: null,
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.canvas = new fabric.Canvas(<HTMLCanvasElement>this.$refs.editorCanvas, {
        backgroundColor: '#000',
        preserveObjectStacking: true,
      });

      this.people.forEach(p => p.addToCanvas(this.canvas!));
      this.resizeCanvas(this.canvasWidth, this.canvasHeight);

      this.canvas.on('object:moving', event => {
        if (event.target === undefined)
          return;

        const target = event.target;
        if (target instanceof fabric.ActiveSelection) {
          // Group of points movement.
          const groupCenter = target.getCenterPoint();
          target.forEachObject(obj => {
            if (obj instanceof OpenposeKeypoint2D) {
              obj.connections.forEach(c => c.update(obj, groupCenter));
            }
          });
        } else if (target instanceof OpenposeKeypoint2D) {
          // Single keypoint movement.
          target.connections.forEach(c => c.update(target, new fabric.Point(0, 0)));
        }
        this.canvas?.renderAll();
      });
    });
  },
  methods: {
    addPerson() {
      const newPerson = new OpenposePerson(null, new OpenposeBody(default_keypoints));
      this.people.push(newPerson);
      newPerson.addToCanvas(this.canvas!);
    },
    removePerson(person: OpenposePerson) {
      this.people = this.people.filter(p => p !== person);
      person.removeFromCanvas(this.canvas!);
    },
    resizeCanvas(newWidth: number, newHeight: number) {
      if (!this.canvas)
        return;
      this.canvas.setWidth(newWidth);
      this.canvas.setHeight(newHeight);
      this.canvas.calcOffset();
      this.canvas.requestRenderAll();
    },
    onVisibleChange(visible: boolean) {
      this.$nextTick(() => {
        // Now, call renderAll() after the visibility updates are done
        this.canvas?.renderAll();
        console.log("renderAll")
      });
    },
  },
  components: {
    PlusSquareOutlined,
    CloseOutlined,
    PersonPanel,
  }
});
</script>

<template>
  <a-row>
    <a-col :span="8">
      <div>
        <a-input-number type="inputNumber" addon-before="Width" addon-after="px" v-model:value="canvasWidth" :min="64"
          :max="4096" />
        <a-input-number type="inputNumber" addon-before="Height" addon-after="px" v-model:value="canvasHeight" :min="64"
          :max="4096" />
        <a-button type="primary" @click="resizeCanvas(canvasWidth, canvasHeight)">Resize Canvas</a-button>
      </div>

      <plus-square-outlined @click="addPerson" />
      <a-collapse>
        <PersonPanel
          v-for="person in people"
          :person="person"
          @removePerson="removePerson"
          @visible-change="onVisibleChange"
        />
      </a-collapse>
    </a-col>

    <a-col :span="16">
      <canvas ref="editorCanvas"></canvas>
    </a-col>
  </a-row>
</template>

<style>
.hidden {
  opacity: 50%;
  text-decoration: line-through;
}
</style> 