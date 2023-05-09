<script lang="ts">
import { defineComponent, type App, type UnwrapRef, reactive } from 'vue';
import { fabric } from 'fabric';
import { PlusSquareOutlined, CloseOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons-vue';
import OpenposeObjectPanel from './components/OpenposeObjectPanel.vue';
import { OpenposePerson, OpenposeBody, OpenposeHand, OpenposeFace, OpenposeKeypoint2D, OpenposeObject, type IOpenposeJson } from './Openpose';
import type { UploadFile } from 'ant-design-vue';
import LockSwitch from './components/LockSwitch.vue';
import _ from 'lodash';

/* 
Dev TODO List:
- Zoom in/out ability
- Attach hand/face to correct location when added
- bind hand/face to body keypoint so that when certain body keypoint moves, hand/face also moves
- Auto-zoom in/out and lock zoom level when face/hand are selected
- Read JSON/background file from POST request params
- post result back to parent frame
- Mount a get/post path on WebUI so that the plugin is accessible
- [Optional]: make a extension tab to in WebUI to host the iframe
 */

interface LockableUploadFile extends UploadFile {
  locked: boolean;
};

interface AppData {
  canvasHeight: number;
  canvasWidth: number;

  personName: string;
  hideInvisibleKeypoints: boolean;
  people: OpenposePerson[];
  keypointMap: Map<number, UnwrapRef<OpenposeKeypoint2D>>,
  canvas: fabric.Canvas | null;

  // Fields for uploaded background images.
  uploadedImageList: LockableUploadFile[];
  canvasImageMap: Map<string, fabric.Image>;
};

const default_body_keypoints: [number, number, number][] = [
  [241, 77], [241, 120], [191, 118], [177, 183],
  [163, 252], [298, 118], [317, 182], [332, 245],
  [225, 241], [213, 359], [215, 454], [270, 240],
  [282, 360], [286, 456], [232, 59], [253, 60],
  [225, 70], [260, 72]
].map(loc => [loc[0], loc[1], 1.0]);

const default_left_hand_keypoints: [number, number, number][] = [
  [
    72.0,
    120.0,
    1.0
  ],
  [
    50.00001525878906,
    108.0,
    1.0
  ],
  [
    26.000015258789062,
    91.0,
    1.0
  ],
  [
    15.0,
    71.0,
    1.0
  ],
  [
    0.0,
    56.0,
    1.0
  ],
  [
    50.00001525878906,
    55.0,
    1.0
  ],
  [
    44.00001525878906,
    30.0,
    1.0
  ],
  [
    42.99998474121094,
    10.0,
    1.0
  ],
  [
    41.00001525878906,
    -117.0,
    1.0
  ],
  [
    66.99998474121094,
    53.0,
    1.0
  ],
  [
    65.00001525878906,
    22.0,
    1.0
  ],
  [
    66.99998474121094,
    0.0,
    1.0
  ],
  [
    -508.0000000298023,
    -117.0,
    1.0
  ],
  [
    81.0,
    56.0,
    1.0
  ],
  [
    81.0,
    30.0,
    1.0
  ],
  [
    83.00001525878906,
    10.0,
    1.0
  ],
  [
    83.00001525878906,
    -117.0,
    1.0
  ],
  [
    96.0,
    64.0,
    1.0
  ],
  [
    102.0,
    43.0,
    1.0
  ],
  [
    107.00001525878906,
    30.0,
    1.0
  ],
  [
    110.00001525878906,
    16.0,
    1.0
  ]
];

const default_right_hand_keypoints: [number, number, number][] = [
  [
    37.00000762939453,
    127.0,
    1.0
  ],
  [
    59.000003814697266,
    119.0,
    1.0
  ],
  [
    83.00000381469727,
    104.0,
    1.0
  ],
  [
    99.99999618530273,
    86.0,
    1.0
  ],
  [
    117.99999618530273,
    75.0,
    1.0
  ],
  [
    64.00000762939453,
    67.0,
    1.0
  ],
  [
    72.0000114440918,
    38.0,
    1.0
  ],
  [
    75.99999618530273,
    21.0,
    1.0
  ],
  [
    80.00000381469727,
    4.0,
    1.0
  ],
  [
    45.0,
    64.0,
    1.0
  ],
  [
    50.000003814697266,
    29.0,
    1.0
  ],
  [
    51.0,
    8.0,
    1.0
  ],
  [
    54.0,
    -104.0,
    1.0
  ],
  [
    29.000003814697266,
    67.0,
    1.0
  ],
  [
    30.0,
    35.0,
    1.0
  ],
  [
    32.000003814697266,
    16.0,
    1.0
  ],
  [
    34.00000762939453,
    0.0,
    1.0
  ],
  [
    11.000003814697266,
    70.0,
    1.0
  ],
  [
    8.000003814697266,
    48.0,
    1.0
  ],
  [
    4.000007629394531,
    35.0,
    1.0
  ],
  [
    0.0,
    21.0,
    1.0
  ]
];

const default_face_keypoints: [number, number, number][] = [];

// identity_metrics * point == point.
const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

export default defineComponent({
  data(): AppData {
    return {
      canvasHeight: 512,
      canvasWidth: 512,
      personName: '',
      hideInvisibleKeypoints: false,
      people: [],
      canvas: null,
      keypointMap: new Map<number, UnwrapRef<OpenposeKeypoint2D>>(),
      uploadedImageList: [],
      canvasImageMap: new Map<string, fabric.Image>(),
    };
  },
  mounted() {
    this.$nextTick(() => {
      this.canvas = new fabric.Canvas(<HTMLCanvasElement>this.$refs.editorCanvas, {
        backgroundColor: '#000',
        preserveObjectStacking: true,
      });
      this.resizeCanvas(this.canvasWidth, this.canvasHeight);
      // By default have a example person.
      this.addDefaultPerson();

      const selectionHandler = (event: fabric.IEvent<MouseEvent>) => {
        // Excluding the selection/deselection event of single keypoint,
        // as they will not create a selection box, and affect the coords
        // of keypoint.
        // When selected, coords of keypoint become relative value to the 
        // selection group center if there are more than 1 point in the 
        // selection group.
        if (event.selected) {
          if (event.selected.length === 1) return;

          event.selected
            .filter(o => o instanceof OpenposeKeypoint2D)
            .forEach(p => this.getKeypointProxy(p as OpenposeKeypoint2D).selected_in_group = true);
        }

        if (event.deselected) {
          if (event.deselected.length === 1) return;

          event.deselected
            .filter(o => o instanceof OpenposeKeypoint2D)
            .forEach(p => this.getKeypointProxy(p as OpenposeKeypoint2D).selected_in_group = false);
        }
      }

      const keypointMoveHandler = (event: fabric.IEvent<MouseEvent>) => {
        if (event.target === undefined)
          return;

        const target = event.target;
        if (target instanceof fabric.ActiveSelection) {
          // Group of points movement.
          const t = target.calcTransformMatrix();
          target.forEachObject(obj => {
            if (obj instanceof OpenposeKeypoint2D) {
              obj.updateConnections(t);
            }
          });
        } else if (target instanceof OpenposeKeypoint2D) {
          // Single keypoint movement.
          target.updateConnections(IDENTITY_MATRIX);
          this.updateKeypointProxy(target);
        }
        this.canvas?.renderAll();
      };

      this.canvas.on('object:moving', keypointMoveHandler);
      this.canvas.on('object:scaling', keypointMoveHandler);
      this.canvas.on('object:rotating', keypointMoveHandler);
      this.canvas.on('selection:created', selectionHandler);
      this.canvas.on('selection:cleared', selectionHandler);
      this.canvas.on('selection:updated', selectionHandler);
    });
  },
  methods: {
    getKeypointProxy(keypoint: OpenposeKeypoint2D): UnwrapRef<OpenposeKeypoint2D> {
      return this.keypointMap.get(keypoint.id)!;
    },
    updateKeypointProxy(keypoint: OpenposeKeypoint2D) {
      const proxy = this.getKeypointProxy(keypoint);

      proxy.x = keypoint.x;
      proxy.y = keypoint.y;
    },
    addPerson(newPerson: OpenposePerson) {
      this.people.push(newPerson);
      newPerson.addToCanvas(this.canvas!);
      // Add the reactive keypoints to the keypointMap
      newPerson.allKeypoints().forEach((keypoint) => {
        this.keypointMap.set(keypoint.id, reactive(keypoint));
      });
      this.canvas?.renderAll();
    },
    addDefaultPerson() {
      const newPerson = new OpenposePerson(null, new OpenposeBody(default_body_keypoints));
      this.addPerson(newPerson);
    },
    removePerson(person: OpenposePerson) {
      this.people = this.people.filter(p => p !== person);
      person.removeFromCanvas(this.canvas!);
      // Remove the reactive keypoints from the keypointMap
      person.allKeypoints().forEach((keypoint) => {
        this.keypointMap.delete(keypoint.id);
      });
      this.canvas?.renderAll();
    },
    addDefaultObject(person: OpenposePerson, obj_name: 'left_hand' | 'right_hand' | 'face') {
      let target: OpenposeObject;
      switch (obj_name) {
        case 'left_hand':
          person.left_hand = new OpenposeHand(default_left_hand_keypoints);
          target = person.left_hand;
          break;
        case 'right_hand':
          person.right_hand = new OpenposeHand(default_right_hand_keypoints);
          target = person.right_hand;
          break;
        case 'face':
          person.face = new OpenposeFace(default_face_keypoints);
          target = person.face;
          break;
      }

      target.addToCanvas(this.canvas!);
      target.keypoints.forEach(keypoint => {
        this.keypointMap.set(keypoint.id, reactive(keypoint));
      });
      this.canvas?.renderAll();
    },
    removeObject(person: OpenposePerson, obj_name: 'left_hand' | 'right_hand' | 'face') {
      let target: OpenposeObject | undefined;
      switch (obj_name) {
        case 'left_hand':
          target = person.left_hand;
          person.left_hand = undefined;
          break;
        case 'right_hand':
          target = person.right_hand;
          person.right_hand = undefined;
          break;
        case 'face':
          target = person.face;
          person.face = undefined;
          break;
      }

      if (!target) return;

      target.removeFromCanvas(this.canvas!);
      target.keypoints.forEach(keypoint => {
        this.keypointMap.delete(keypoint.id);
      });
      this.canvas?.renderAll();
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
      });
    },
    onLockedChange(file: LockableUploadFile, locked: boolean) {
      const img = this.canvasImageMap.get(file.uid);
      if (!img) return;

      if (locked) {
        if (this.canvas?.getActiveObjects().includes(img)) {
          this.canvas.discardActiveObject();
        }
        img.set({
          selectable: false,
          evented: false,
        });
      } else {
        img.set({
          selectable: true,
          evented: true,
        });
      }
      this.canvas?.renderAll();
    },
    onCoordsChange(keypoint: OpenposeKeypoint2D) {
      keypoint.updateConnections(IDENTITY_MATRIX);
      keypoint.setCoords();
      this.canvas?.renderAll();
    },
    onActiveOpenposeObjectPanelChange(activePanelIds: string[]) {
      if (!this.canvas) return;

      this.canvas.discardActiveObject();
      const allKeypoints: OpenposeKeypoint2D[] = [];
      activePanelIds.forEach(id => {
        const person = this.people.filter(p => p.id == parseInt(id))[0];
        allKeypoints.push(...person.allKeypoints());
      });
      const activeSelection = new fabric.ActiveSelection(
        allKeypoints,
        { canvas: this.canvas }
      );
      this.canvas.setActiveObject(activeSelection);
      this.canvas.renderAll();
    },
    handleBeforeUploadImage(file: Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        fabric.Image.fromURL(e.target!.result! as string, (img) => {
          img.set({
            left: 0,
            top: 0,
            scaleX: 1.0,
            scaleY: 1.0,
            opacity: 0.5,
          });

          this.canvas?.add(img);
          // Image should not block skeleton.
          this.canvas?.moveTo(img, 0);
          this.canvas?.renderAll();

          const uploadFile = this.uploadedImageList[this.uploadedImageList.length - 1];
          uploadFile.locked = false;
          this.canvasImageMap.set(uploadFile.uid, img);
        });
      };
      reader.readAsDataURL(file);

      // Return false to prevent the default upload behavior
      return false;
    },
    isImage(file: UploadFile) {
      return /\.(jpeg|jpg|gif|png|bmp)$/i.test(file.name);
    },
    handleRemoveImage(image: UploadFile) {
      if (!this.canvasImageMap.has(image.uid)) return;

      this.canvas?.remove(this.canvasImageMap.get(image.uid)!);
      this.canvas?.renderAll();
    },
    handleBeforeUploadJson(file: Blob) {
      function preprocessPoints(nums: number[], canvasWidth: number, canvasHeight: number): [number, number, number][] {
        const points = _.chunk(nums, 3) as [number, number, number][];
        return points.map(p => [p[0] * canvasWidth, p[1] * canvasHeight, p[2]]);
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const poseJson = JSON.parse(e.target!.result! as string) as IOpenposeJson;
        const canvasHeight = poseJson.canvas_height;
        const canvasWidth = poseJson.canvas_width;

        this.canvasHeight = _.max([canvasHeight, this.canvasHeight])!;
        this.canvasWidth = _.max([canvasWidth, this.canvasWidth])!;
        this.resizeCanvas(this.canvasWidth, this.canvasHeight);

        poseJson.people.forEach(personJson => {
          this.addPerson(new OpenposePerson(null,
            new OpenposeBody(preprocessPoints(personJson.pose_keypoints_2d, canvasWidth, canvasHeight)),
            personJson.hand_left_keypoints_2d ?
              new OpenposeHand(preprocessPoints(personJson.hand_left_keypoints_2d, canvasWidth, canvasHeight)) : undefined,
            personJson.hand_right_keypoints_2d ?
              new OpenposeHand(preprocessPoints(personJson.hand_right_keypoints_2d, canvasWidth, canvasHeight)) : undefined,
            personJson.face_keypoints_2d ?
              new OpenposeFace(preprocessPoints(personJson.face_keypoints_2d, canvasWidth, canvasHeight)) : undefined,
          ));
        });
      };

      reader.readAsText(file);
      return false;
    },
    downloadCanvasAsJson() {
      const data = {
        people: this.people.map(person => person.toJson()),
        canvas_width: this.canvasWidth,
        canvas_height: this.canvasHeight,
      } as IOpenposeJson;

      const json = JSON.stringify(data);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pose.json';
      link.click();
    }
  },
  components: {
    PlusSquareOutlined,
    CloseOutlined,
    UploadOutlined,
    DownloadOutlined,
    OpenposeObjectPanel,
    LockSwitch,
  }
});
</script>

<template>
  <a-row>
    <a-col :span="8">
      <a-divider orientation="left" orientation-margin="0px">
        Canvas
      </a-divider>
      <div>
        <a-input-number type="inputNumber" addon-before="Width" addon-after="px" v-model:value="canvasWidth" :min="64"
          :max="4096" />
        <a-input-number type="inputNumber" addon-before="Height" addon-after="px" v-model:value="canvasHeight" :min="64"
          :max="4096" />
        <a-button type="primary" @click="resizeCanvas(canvasWidth, canvasHeight)">Resize Canvas</a-button>
      </div>
      <a-divider orientation="left" orientation-margin="0px">
        Background Image
      </a-divider>
      <a-upload v-model:file-list="uploadedImageList" list-type="picture" accept="image/*"
        :beforeUpload="handleBeforeUploadImage" @remove="handleRemoveImage">
        <a-button>
          <upload-outlined></upload-outlined>
          Upload Image
        </a-button>
        <template #itemRender="{ file, actions }">
          <a-card class="uploaded-file-item">
            <LockSwitch v-model:locked="file.locked" @update:locked="onLockedChange(file, $event)" />
            <img v-if="isImage(file)" :src="file.thumbUrl || file.url" :alt="file.name" class="image-thumbnail" />
            <span>{{ file.name }}</span>
            <close-outlined @click="actions.remove" class="close-icon" />
          </a-card>
        </template>
      </a-upload>
      <a-divider orientation="left" orientation-margin="0px">
        Pose Control
      </a-divider>
      <a-button @click="addDefaultPerson">
        <plus-square-outlined />
        Add Person
      </a-button>
      <a-upload accept="application/json" :beforeUpload="handleBeforeUploadJson" :showUploadList="false">
        <a-button>
          <upload-outlined></upload-outlined>
          Upload JSON
        </a-button>
      </a-upload>
      <a-button @click="downloadCanvasAsJson">
        <download-outlined></download-outlined>
        Download JSON
      </a-button>
      <a-collapse @change="onActiveOpenposeObjectPanelChange">
        <OpenposeObjectPanel v-for="person in people" :object="person.body" :display_name="person.name"
          @removeObject="removePerson(person)" @update:visible="onVisibleChange" @keypoint-coords-change="onCoordsChange"
          :key="person.id">
          <template #extra-control>
            <a-button v-if="person.left_hand === undefined" @click="addDefaultObject(person, 'left_hand')">Add left
              hand</a-button>
            <a-button v-if="person.right_hand === undefined" @click="addDefaultObject(person, 'right_hand')">Add right
              hand</a-button>
            <a-button v-if="person.face === undefined" @click="addDefaultObject(person, 'face')">Add face</a-button>
            <a-collapse accordion>
              <OpenposeObjectPanel v-if="person.left_hand !== undefined" :object="person.left_hand"
                :display_name="'Left Hand'" @removeObject="removeObject(person, 'left_hand')"
                @keypoint-coords-change="onCoordsChange" @update:visible="onVisibleChange" />
              <OpenposeObjectPanel v-if="person.right_hand !== undefined" :object="person.right_hand"
                :display_name="'Right Hand'" @removeObject="removeObject(person, 'right_hand')"
                @keypoint-coords-change="onCoordsChange" @update:visible="onVisibleChange" />
              <OpenposeObjectPanel v-if="person.face !== undefined" :object="person.face" :display_name="'Face'"
                @removeObject="removeObject(person, 'face')" @keypoint-coords-change="onCoordsChange"
                @update:visible="onVisibleChange" />
            </a-collapse>
          </template>
        </OpenposeObjectPanel>
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