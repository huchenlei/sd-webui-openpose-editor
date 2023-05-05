<script lang="ts">
import { defineComponent, type App } from 'vue';
import { fabric } from 'fabric';
import _ from 'lodash';

class OpenposeKeypoint2D extends fabric.Circle {
  static radius: number = 2;

  confidence: number;
  name: string;
  connections: Array<OpenposeConnection>;

  constructor(x: number, y: number, confidence: number, color: string, name: string) {
    super({
      radius: OpenposeKeypoint2D.radius,
      left: x - OpenposeKeypoint2D.radius,
      top: y - OpenposeKeypoint2D.radius,
      fill: color,
      stroke: color,
      strokeWidth: 1,
      hasControls: false, // Disallow user to scale the keypoint circle.
      hasBorders: false,
    });

    this.confidence = confidence;
    this.name = name;
    this.connections = [];
  }

  addConnection(connection: OpenposeConnection): void {
    this.connections.push(connection);
  }

  get x(): number {
    return this.left! + OpenposeKeypoint2D.radius;
  }

  get y(): number {
    return this.top! + OpenposeKeypoint2D.radius;
  }
};

class OpenposeConnection extends fabric.Line {
  k1: OpenposeKeypoint2D;
  k2: OpenposeKeypoint2D;

  constructor(k1: OpenposeKeypoint2D, k2: OpenposeKeypoint2D, color: string) {
    super([k1.x, k1.y, k2.x, k2.y], {
      fill: color,
      stroke: color,
      strokeWidth: 2,
      // Connections(Edges) themselves are not selectable, they will adjust when relevant keypoints move.
      selectable: false,
      // Connections should not appear in events.
      evented: false,
    });
    this.k1 = k1;
    this.k2 = k2;
    this.k1.addConnection(this);
    this.k2.addConnection(this);
  }
};

interface OpenposeObject {
  keypoints: OpenposeKeypoint2D[];
  connections: OpenposeConnection[];
};

class OpenposeBody implements OpenposeObject {
  keypoints: OpenposeKeypoint2D[];
  connections: OpenposeConnection[];

  static keypoints_connections: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [1, 5], [5, 6], [6, 7], [1, 8],
    [8, 9], [9, 10], [1, 11], [11, 12],
    [12, 13], [0, 14], [14, 16], [0, 15],
    [15, 17],
  ];

  static colors: [number, number, number][] = [
    [255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0],
    [170, 255, 0], [85, 255, 0], [0, 255, 0], [0, 255, 85],
    [0, 255, 170], [0, 255, 255], [0, 170, 255], [0, 85, 255],
    [0, 0, 255], [85, 0, 255], [170, 0, 255], [255, 0, 255],
    [255, 0, 170], [255, 0, 85]
  ];

  static keypoint_names = [
    "nose",
    "neck",
    "right_shoulder",
    "right_elbow",
    "right_wrist",
    "left_shoulder",
    "left_elbow",
    "left_wrist",
    "right_hip",
    "right_knee",
    "right_ankle",
    "left_hip",
    "left_knee",
    "left_ankle",
    "right_eye",
    "left_eye",
    "right_ear",
    "left_ear",
  ];

  /**
   * @param {Array<Array<float>>} rawKeypoints keypoints directly read from the openpose JSON format
   * [
   *   [x1, y1, c1],
   *   [x2, y2, c2],
   *   ...
   * ]
   */
  constructor(rawKeypoints: [number, number, number][]) {
    function formatColor(color: [number, number, number]): string {
      return `rgba(${color.join(", ")}, 0.7)`;
    }

    /* Coco format has 18 keypoints. */
    if (rawKeypoints.length != 18) {
      throw `Wrong number of keypoints for openpose body(Coco format). Expect 18 but got ${rawKeypoints.length}.`
    }

    this.keypoints = _.zipWith(rawKeypoints, OpenposeBody.colors, OpenposeBody.keypoint_names,
      (p, color, keypoint_name) => new OpenposeKeypoint2D(
        p[0],
        p[1],
        p[2],
        formatColor(color),
        keypoint_name
      ));

    this.connections = _.zipWith(OpenposeBody.keypoints_connections, OpenposeBody.colors.slice(0, 17),
      (connection, color) => {
        return new OpenposeConnection(
          this.keypoints[connection[0]],
          this.keypoints[connection[1]],
          formatColor(color)
        );
      });
  }
};

class OpenposePerson {
  name: string;
  body: OpenposeBody;
  id: number;
  visible: boolean;

  constructor(name: string, body: OpenposeBody) {
    this.name = name;
    this.body = body;
    this.id = id++;
    this.visible = true;
  }
};

interface AppData {
  personName: string;
  hideInvisibleKeypoints: boolean;
  people: OpenposePerson[];
};

let id = 0

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
      personName: '',
      hideInvisibleKeypoints: false,
      people: [
        new OpenposePerson('Example Person', new OpenposeBody(default_keypoints)),
      ]
    }
  },
  methods: {
    addPerson() {
      this.people.push(new OpenposePerson(this.personName, new OpenposeBody(default_keypoints)));
      this.personName = '';
    },
    removePerson(person: OpenposePerson) {
      this.people = this.people.filter(p => p !== person);
    }
  }
});
</script>

<template>
  <form @submit.prevent="addPerson">
    <input v-model="personName">
    <button>Add Person</button>
  </form>
  <ul>
    <li v-for="person in people" :key="person.id">
      <input type="checkbox" v-model="person.visible">
      <span :class="{ hidden: !person.visible }">{{ person.name }}</span>
      <button @click="removePerson(person)">X</button>
    </li>
  </ul>
  <button @click="hideInvisibleKeypoints = !hideInvisibleKeypoints">
    {{ hideInvisibleKeypoints ? 'Show all' : 'Hide completed' }}
  </button>
</template>

<style>
.hidden {
  display: none;
}
</style>