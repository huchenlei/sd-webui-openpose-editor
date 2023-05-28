<script lang="ts">
import { defineComponent, type UnwrapRef, reactive, ref } from 'vue';
import { fabric } from 'fabric';
import { PlusSquareOutlined, CloseOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons-vue';
import OpenposeObjectPanel from './components/OpenposeObjectPanel.vue';
import { OpenposePerson, OpenposeBody, OpenposeHand, OpenposeFace, OpenposeKeypoint2D, OpenposeObject, type IOpenposeJson, OpenposeBodyPart } from './Openpose';
import type { UploadFile } from 'ant-design-vue';
import LockSwitch from './components/LockSwitch.vue';
import _ from 'lodash';

/* 
Dev TODO List:
- [Optional] Zoom in/out ability
- [Optional] bind hand/face to body keypoint so that when certain body keypoint moves, hand/face also moves
 */

interface LockableUploadFile extends UploadFile {
  locked: boolean;
  scale: number;
};

interface AppData {
  canvasHeight: number;
  canvasWidth: number;

  personName: string;
  hideInvisibleKeypoints: boolean;
  people: Map<number, OpenposePerson>;
  keypointMap: Map<number, UnwrapRef<OpenposeKeypoint2D>>,
  canvas: fabric.Canvas | null;

  // Fields for uploaded background images.
  uploadedImageList: LockableUploadFile[];
  canvasImageMap: Map<string, fabric.Image>;

  // The corresponding OpenposePerson that the user has the collapse element
  // expanded.
  activePersonId: string | undefined;
  // The corresponding OpenposeObject(Hand/Face) that the user has the
  // collapse element expanded.
  activeBodyPart: OpenposeBodyPart | undefined;

  // The modal id to post message back to.
  modalId: string | undefined;
};

/**
 * The frame message from the main frame (ControlNet).
 */
interface IncomingFrameMessage {
  modalId: string;
  imageURL: string;
  poseURL: string;
};

interface OutgoingFrameMessage {
  modalId: string;
  poseURL: string;
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

function parseDataURLtoJSON(dataURL: string): any {
  const data = dataURL.split(',')[1]; // Extract the data portion
  const decodedData = atob(data); // Decode the data
  const json = JSON.parse(decodedData); // Parse the decoded data as JSON
  return json;
}

function serializeJSONtoDataURL(data: any): string {
  return "data:application/json;base64,"+btoa(JSON.stringify(data));
}

async function calculateHash(s: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(s);

  const buffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(buffer));
  const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

function getImageDimensionsFromDataURL(dataURL: string): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = function () {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      resolve([width, height]);
    };

    img.onerror = function () {
      reject(new Error('Failed to load image.'));
    };

    img.src = dataURL;
  });
}

export default defineComponent({
  data(): AppData {
    return {
      canvasHeight: 512,
      canvasWidth: 512,
      personName: '',
      hideInvisibleKeypoints: false,
      people: new Map<number, OpenposePerson>(),
      canvas: null,
      keypointMap: new Map<number, UnwrapRef<OpenposeKeypoint2D>>(),
      uploadedImageList: [],
      canvasImageMap: new Map<string, fabric.Image>(),
      activePersonId: undefined,
      activeBodyPart: undefined,
      modalId: undefined,
    };
  },
  setup() {
    return { OpenposeBodyPart };
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

      // Handle incoming frame message.
      window.addEventListener('message', (event) => {
        const message = event.data as IncomingFrameMessage;
        this.loadCanvasFromFrameMessage(message);
      });
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
      this.people.set(newPerson.id, newPerson);
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
      // If the person is active right now, deactivate it.
      if (person.id.toString() === this.activePersonId) {
        this.updateActivePerson(undefined);
      }

      this.people.delete(person.id);
      person.removeFromCanvas(this.canvas!);
      // Remove the reactive keypoints from the keypointMap
      person.allKeypoints().forEach((keypoint) => {
        this.keypointMap.delete(keypoint.id);
      });
      this.canvas?.renderAll();
    },
    addDefaultObject(person: OpenposePerson, part: OpenposeBodyPart) {
      let target: OpenposeObject;
      switch (part) {
        case OpenposeBodyPart.LEFT_HAND:
          target = new OpenposeHand(default_left_hand_keypoints);
          break;
        case OpenposeBodyPart.RIGHT_HAND:
          target = new OpenposeHand(default_right_hand_keypoints);
          break;
        case OpenposeBodyPart.FACE:
          person.face = new OpenposeFace(default_face_keypoints);
          target = person.face;
          break;
      }
      this.addObject(person, part, target);
    },
    addObject(person: OpenposePerson, part: OpenposeBodyPart, target: OpenposeObject) {
      target.addToCanvas(this.canvas!);
      target.keypoints.forEach(keypoint => {
        this.keypointMap.set(keypoint.id, reactive(keypoint));
      });

      switch (part) {
        case OpenposeBodyPart.LEFT_HAND:
          person.attachLeftHand(target as OpenposeHand);
          break;
        case OpenposeBodyPart.RIGHT_HAND:
          person.attachRightHand(target as OpenposeHand);
          break;
        case OpenposeBodyPart.FACE:
          person.attachFace(target as OpenposeFace);
          break;
      }
      this.canvas?.renderAll();
    },
    removeObject(person: OpenposePerson, part: OpenposeBodyPart) {
      let target: OpenposeObject | undefined;
      switch (part) {
        case OpenposeBodyPart.LEFT_HAND:
          target = person.left_hand;
          person.left_hand = undefined;
          break;
        case OpenposeBodyPart.RIGHT_HAND:
          target = person.right_hand;
          person.right_hand = undefined;
          break;
        case OpenposeBodyPart.FACE:
          target = person.face;
          person.face = undefined;
          break;
      }

      if (!target) return;

      target.removeFromCanvas(this.canvas!);
      target.keypoints.forEach(keypoint => {
        this.keypointMap.delete(keypoint.id);
      });
      if (this.activeBodyPart === part) {
        this.updateActiveBodyPart(undefined, person);
      }
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
          hasControls: false,
          hasBorders: false,
        });
      } else {
        img.set({
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
        });
      }
      this.canvas?.renderAll();
    },
    updateActivePerson(activePersonId: string | undefined) {
      if (this.activePersonId === activePersonId) return;

      if (!activePersonId) {
        // Collapse current panel.
        // If there is a body part panel expanded, collapse that as well.
        const activePerson = this.people.get(parseInt(this.activePersonId!))!;
        this.updateActiveBodyPart(undefined, activePerson);
      }

      this.activePersonId = activePersonId;
    },
    updateActiveBodyPart(activeBodyPart: OpenposeBodyPart | undefined, person: OpenposePerson) {
      if (this.activeBodyPart === activeBodyPart) return;

      if (activeBodyPart === undefined) {
        if (this.activeBodyPart !== undefined) {
          // There can only be one active person. If we collapse the person panel
          // or collapse the body part panel. This function can still receive the 
          // correct person of the targeted object.
          const target = person[this.activeBodyPart]!;
          if (target)
            target.grouped = true;
        }
        this.resetZoom();
      } else {
        const target = person[activeBodyPart]!;
        target.grouped = true;
        this.zoomToGroup(target.group!, /* zoomed_size=*/ 0.8);
        // Ungroup the object so that user can operate on each individual keypoint.
        target.grouped = false;
      }
      this.activeBodyPart = activeBodyPart;
    },
    resetZoom() {
      if (!this.canvas) return;
      this.canvas.setViewportTransform(IDENTITY_MATRIX);
    },
    /**
     * Adjust canvas zoom level to fit the target group's bounding box.
     * @param group The group object to zoom into.
     * @param zoomed_size: How big should the group take the space of the zoomed canvas.
     */
    zoomToGroup(group: fabric.Group, zoomed_size: number = 1.0) {
      if (!this.canvas) return;

      // Get the bounding rectangle of the group
      const boundingRect = group.getBoundingRect();

      // Calculate the scale factor
      const scaleFactor = Math.min(
        this.canvas.getWidth() / boundingRect.width,
        this.canvas.getHeight() / boundingRect.height
      ) * zoomed_size;

      // Set the zoom level and center the viewport
      const centerX = boundingRect.left + boundingRect.width / 2;
      const centerY = boundingRect.top + boundingRect.height / 2;
      const center = new fabric.Point(centerX, centerY);
      this.canvas.zoomToPoint(center, scaleFactor);
    },
    handleBeforeUploadImage(file: Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.loadBackgroundImageFromURL(e.target!.result! as string);
      };
      reader.readAsDataURL(file);

      // Return false to prevent the default upload behavior
      return false;
    },
    loadBackgroundImageFromURL(url: string) {
      fabric.Image.fromURL(url, (img) => {
        img.set({
          left: 0,
          top: 0,
          scaleX: 1.0,
          scaleY: 1.0,
          opacity: 0.5,
          hasControls: true,
          hasBorders: true,
          lockScalingX: false,
          lockScalingY: false,
        });

        this.canvas?.add(img);
        // Image should not block skeleton.
        this.canvas?.moveTo(img, 0);
        this.canvas?.renderAll();

        const uploadFile = this.uploadedImageList[this.uploadedImageList.length - 1];
        uploadFile.locked = false;
        uploadFile.scale = 1.0;
        this.canvasImageMap.set(uploadFile.uid, img);
      });
    },
    isImage(file: UploadFile) {
      return /\.(jpeg|jpg|gif|png|bmp)$/i.test(file.name);
    },
    handleRemoveImage(image: UploadFile) {
      if (!this.canvasImageMap.has(image.uid)) return;

      this.canvas?.remove(this.canvasImageMap.get(image.uid)!);
      this.canvas?.renderAll();
    },
    scaleImage(image: LockableUploadFile, scale: number) {
      image.scale = scale;
      if (!this.canvasImageMap.has(image.uid)) return;

      const img = this.canvasImageMap.get(image.uid)!;
      img.set({
        scaleX: scale,
        scaleY: scale,
      });

      this.canvas?.renderAll();
    },
    readOpenposeJson(file: Blob): Promise<IOpenposeJson> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          let poseJson: IOpenposeJson;
          try {
            poseJson = JSON.parse(e.target!.result! as string) as IOpenposeJson;
          } catch (ex: any) {
            reject(ex);
            return;
          }
          resolve(poseJson);
        };
        reader.readAsText(file);
      });
    },
    parseOpenposeJson(poseJson: IOpenposeJson): OpenposePerson[] {
      function preprocessPoints(nums: number[], canvasWidth: number, canvasHeight: number): [number, number, number][] {
        const points = _.chunk(nums, 3) as [number, number, number][];
        return points.map(p => [p[0] * canvasWidth, p[1] * canvasHeight, p[2]]);
      }
      const canvasHeight = poseJson.canvas_height;
      const canvasWidth = poseJson.canvas_width;
      return poseJson.people.map(personJson =>
        new OpenposePerson(null,
          new OpenposeBody(preprocessPoints(personJson.pose_keypoints_2d, canvasWidth, canvasHeight)),
          personJson.hand_left_keypoints_2d ?
            new OpenposeHand(preprocessPoints(personJson.hand_left_keypoints_2d, canvasWidth, canvasHeight)) : undefined,
          personJson.hand_right_keypoints_2d ?
            new OpenposeHand(preprocessPoints(personJson.hand_right_keypoints_2d, canvasWidth, canvasHeight)) : undefined,
          personJson.face_keypoints_2d ?
            new OpenposeFace(preprocessPoints(personJson.face_keypoints_2d, canvasWidth, canvasHeight)) : undefined,
        )
      );
    },
    /**
     * Adds a body part from the given JSON file.
     * The given JSON is expected to only have one person.
     * @param file JSON file blob
     * @param person 
     * @param part 
     */
    addJsonObject(file: Blob, person: OpenposePerson, part: OpenposeBodyPart) {
      this.readOpenposeJson(file).then(this.parseOpenposeJson).then((people: OpenposePerson[]) => {
        if (people.length === 0) return;
        const firstPerson = people[0];
        switch (part) {
          case OpenposeBodyPart.LEFT_HAND:
            if (firstPerson.left_hand === undefined) {
              this.$notify({ title: 'Error', desc: 'Left hand does not exist in Json' });
              return;
            }
            this.addObject(person, part, firstPerson.left_hand);
            break;
          case OpenposeBodyPart.RIGHT_HAND:
            if (firstPerson.right_hand === undefined) {
              this.$notify({ title: 'Error', desc: 'Right hand does not exist in Json' });
              return;
            }
            this.addObject(person, part, firstPerson.right_hand);
            break;
          case OpenposeBodyPart.FACE:
            if (firstPerson.face === undefined) {
              this.$notify({ title: 'Error', desc: 'Face does not exist in Json' });
              return;
            }
            this.addObject(person, part, firstPerson.face);
            break;
        }
      });
      return false;
    },
    /**
     * Adds all people specified in the given JSON file to canvas.
     * @param file JSON file blob
     */
    handleBeforeUploadJson(file: Blob) {
      this.readOpenposeJson(file).then(this.loadPeopleFromJson);
      return false;
    },
    loadPeopleFromJson(poseJson: IOpenposeJson) {
      const canvasHeight = poseJson.canvas_height;
      const canvasWidth = poseJson.canvas_width;
      this.canvasHeight = _.max([canvasHeight, this.canvasHeight])!;
      this.canvasWidth = _.max([canvasWidth, this.canvasWidth])!;
      this.resizeCanvas(this.canvasWidth, this.canvasHeight);
      this.parseOpenposeJson(poseJson).forEach(person => this.addPerson(person));
    },
    /**
     * Clear everything on the canvas.
     */
    clearCanvas() {
      // Remove all people.
      [...this.people.values()].forEach(person => {
        this.removePerson(person);
      });
      // Remove all background images.
      this.uploadedImageList.forEach(image => {
        this.handleRemoveImage(image);
      });
      this.uploadedImageList.splice(0); // Clear `uploadedImageList`.
      this.resetZoom();
    },
    loadCanvasFromRequestParams() {
      this.clearCanvas();
      const data = window.dataFromServer;
      if (_.isEmpty(data)) {
        return;
      }

      let poseJson: IOpenposeJson;
      try {
        poseJson = JSON.parse(data.pose) as IOpenposeJson;
      } catch (ex: any) {
        this.$notify({ title: 'Error', desc: ex.message });
        return;
      }
      this.loadPeopleFromJson(poseJson);
      this.loadBackgroundImageFromURL(data.image_url);
    },
    async loadCanvasFromFrameMessage(message: IncomingFrameMessage) {
      this.modalId = message.modalId;

      this.clearCanvas();
      // Load people first to set the canvas width/height first.
      this.loadPeopleFromJson(parseDataURLtoJSON(message.poseURL) as IOpenposeJson);

      const imageFile = {
        locked: false,
        scale: 1.0,
        name: 'controlnet input',
        uid: await calculateHash(message.imageURL),
      } as LockableUploadFile;
      this.uploadedImageList.push(imageFile);
      this.loadBackgroundImageFromURL(message.imageURL);
      const [imgWidth, imgHeight] = await getImageDimensionsFromDataURL(message.imageURL);
      this.scaleImage(imageFile, Math.min(this.canvasHeight / imgHeight, this.canvasWidth / imgWidth));
      imageFile.locked = true;
    },
    getCanvasAsOpenposeJson(): IOpenposeJson {
      return {
        people: [...this.people.values()].map(person => person.toJson()),
        canvas_width: this.canvasWidth,
        canvas_height: this.canvasHeight,
      } as IOpenposeJson;
    },
    sendCanvasAsFrameMessage() {
      if (this.modalId === undefined) return;
      window.parent.postMessage({
        modalId: this.modalId,
        poseURL: serializeJSONtoDataURL(this.getCanvasAsOpenposeJson()),
      } as OutgoingFrameMessage, '*');
    },
    downloadCanvasAsJson() {
      const link = document.createElement('a');
      link.href = serializeJSONtoDataURL(this.getCanvasAsOpenposeJson());
      link.download = 'pose.json';
      link.click();
    },
    downloadCanvasAsImage() {
      if (!this.canvas) return;
      // Get the data URL of the canvas as a PNG image
      const dataUrl = this.canvas.toDataURL({ format: 'image/png' });
      // Create an img element with the data URL
      const img = document.createElement('img');
      img.src = dataUrl;
      // Create a link element with the data URL
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'pose.png';
      // Trigger a click event on the link to initiate the download
      link.click();
    },
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
      <a-button v-if="modalId !== undefined" @click="sendCanvasAsFrameMessage">
        Send pose to ControlNet
      </a-button>
      <a-divider orientation="left" orientation-margin="0px">
        Canvas
      </a-divider>
      <div>
        <a-space>
          <a-input-number type="inputNumber" addon-before="Width" addon-after="px" v-model:value="canvasWidth" :min="64"
            :max="4096" />
          <a-input-number type="inputNumber" addon-before="Height" addon-after="px" v-model:value="canvasHeight" :min="64"
            :max="4096" />
          <a-button @click="resizeCanvas(canvasWidth, canvasHeight)">Resize Canvas</a-button>
        </a-space>
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
            <a-input-number class="scale-ratio-input" addon-before="scale ratio" @update:value="scaleImage(file, $event)"
              :min="0" v-model:value="file.scale" />
            <close-outlined @click="actions.remove" class="close-icon" />
          </a-card>
        </template>
      </a-upload>
      <a-divider orientation="left" orientation-margin="0px">
        Pose Control
      </a-divider>
      <a-space>
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
        <a-button @click="downloadCanvasAsImage">
          <download-outlined></download-outlined>
          Download Image
        </a-button>
      </a-space>
      <a-collapse accordion :activeKey="activePersonId" @update:activeKey="updateActivePerson">
        <OpenposeObjectPanel v-for="person in people.values()" :object="person.body" :display_name="person.name"
          @removeObject="removePerson(person)" :key="person.id">
          <template #extra-control>
            <!-- TODO: make this repetitive code a component. -->
            <div v-if="person.left_hand === undefined">
              <a-button @click="addDefaultObject(person, OpenposeBodyPart.LEFT_HAND)">Add left
                hand</a-button>
              <a-upload accept="application/json"
                :beforeUpload="(file: Blob) => addJsonObject(file, person, OpenposeBodyPart.LEFT_HAND)"
                :showUploadList="false">
                <a-button>
                  <upload-outlined></upload-outlined>
                </a-button>
              </a-upload>
            </div>
            <div v-if="person.right_hand === undefined">
              <a-button @click="addDefaultObject(person, OpenposeBodyPart.RIGHT_HAND)">Add right
                hand</a-button>
              <a-upload accept="application/json"
                :beforeUpload="(file: Blob) => addJsonObject(file, person, OpenposeBodyPart.RIGHT_HAND)"
                :showUploadList="false">
                <a-button>
                  <upload-outlined></upload-outlined>
                </a-button>
              </a-upload>
            </div>
            <div v-if="person.face === undefined">
              <a-upload accept="application/json"
                :beforeUpload="(file: Blob) => addJsonObject(file, person, OpenposeBodyPart.FACE)"
                :showUploadList="false">
                <a-button>
                  Add Face
                  <upload-outlined></upload-outlined>
                </a-button>
              </a-upload>
            </div>
            <a-collapse accordion :activeKey="activeBodyPart" @update:activeKey="updateActiveBodyPart($event, person)">
              <OpenposeObjectPanel v-if="person.left_hand !== undefined" :object="person.left_hand"
                :display_name="'Left Hand'" @removeObject="removeObject(person, OpenposeBodyPart.LEFT_HAND)"
                :key="OpenposeBodyPart.LEFT_HAND" />
              <OpenposeObjectPanel v-if="person.right_hand !== undefined" :object="person.right_hand"
                :display_name="'Right Hand'" @removeObject="removeObject(person, OpenposeBodyPart.RIGHT_HAND)"
                :key="OpenposeBodyPart.RIGHT_HAND" />
              <OpenposeObjectPanel v-if="person.face !== undefined" :object="person.face" :display_name="'Face'"
                @removeObject="removeObject(person, OpenposeBodyPart.FACE)" :key="OpenposeBodyPart.FACE" />
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