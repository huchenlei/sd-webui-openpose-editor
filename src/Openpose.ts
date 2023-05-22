import { fabric } from 'fabric';
import _ from 'lodash';

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

class OpenposeKeypoint2D extends fabric.Circle {
    static radius: number = 2;
    static idCounter: number = 0;
    id: number;
    confidence: number;
    name: string;
    connections: Array<OpenposeConnection>;
    selected_in_group: boolean;

    constructor(x: number, y: number, confidence: number, color: string, name: string, opacity: number = 1.0) {
        super({
            radius: OpenposeKeypoint2D.radius,
            left: x - OpenposeKeypoint2D.radius,
            top: y - OpenposeKeypoint2D.radius,
            fill: color,
            stroke: color,
            strokeWidth: 1,
            hasControls: false, // Disallow user to scale the keypoint circle.
            hasBorders: false,
            opacity: opacity,
        });

        this.confidence = confidence;
        this.name = name;
        this.connections = [];
        this.id = OpenposeKeypoint2D.idCounter++;
        this.selected_in_group = false;

        this.on('scaling', this._maintainConstantRadius.bind(this));
        this.on('skewing', this._maintainConstantRadius.bind(this));
    }

    addConnection(connection: OpenposeConnection): void {
        this.connections.push(connection);
    }

    updateConnections(transformMatrix: number[]) {
        if (transformMatrix.length !== 6)
            throw `Expect transformMatrix of length 6 but get ${transformMatrix}`;

        this.connections.forEach(c => c.update(this, transformMatrix));
    }

    _set(key: string, value: any): this {
        if (key === 'scaleX' || key === 'scaleY') {
            super._set('scaleX', 1);
            super._set('scaleY', 1);
        } else {
            super._set(key, value);
        }
        return this;
    }

    _maintainConstantRadius(): void {
        this.set('radius', OpenposeKeypoint2D.radius);
        this.setCoords();
    }

    get x(): number {
        return this.left! + OpenposeKeypoint2D.radius;
    }

    set x(x: number) {
        this.left = x - OpenposeKeypoint2D.radius;
    }

    get y(): number {
        return this.top! + OpenposeKeypoint2D.radius;
    }

    set y(y: number) {
        this.top = y - OpenposeKeypoint2D.radius;
    }

    get _visible(): boolean {
        return this.visible === undefined ? true : this.visible;
    }

    set _visible(visible: boolean) {
        this.visible = visible;
        this.connections.forEach(c => {
            c.updateVisibility();
        });
    }

    get abs_point(): fabric.Point {
        if (this.group) {
            const transformMatrix = this.group.calcTransformMatrix();
            return fabric.util.transformPoint(new fabric.Point(this.x, this.y), transformMatrix);
        } else {
            return new fabric.Point(this.x, this.y);
        }
    }

    get abs_x(): number {
        return this.abs_point.x;
    }

    get abs_y(): number {
        return this.abs_point.y;
    }

    distanceTo(other: OpenposeKeypoint2D): number {
        return Math.sqrt(
            Math.pow(this.x - other.x, 2) +
            Math.pow(this.y - other.y, 2)
        );
    }
};

class OpenposeConnection extends fabric.Line {
    k1: OpenposeKeypoint2D;
    k2: OpenposeKeypoint2D;

    constructor(k1: OpenposeKeypoint2D, k2: OpenposeKeypoint2D, color: string, opacity: number = 1.0) {
        super([k1.x, k1.y, k2.x, k2.y], {
            fill: color,
            stroke: color,
            strokeWidth: 2,
            // Connections(Edges) themselves are not selectable, they will adjust when relevant keypoints move.
            selectable: false,
            // Connections should not appear in events.
            evented: false,
            opacity: opacity,
        });
        this.k1 = k1;
        this.k2 = k2;
        this.k1.addConnection(this);
        this.k2.addConnection(this);
    }

    /**
     * Update the connection because the coords of any of the keypoints has 
     * changed. 
     */
    update(p: OpenposeKeypoint2D, transformMatrix: number[]) {
        const globalPoint = fabric.util.transformPoint(new fabric.Point(p.x, p.y), transformMatrix);
        if (p === this.k1) {
            this.set({
                x1: globalPoint.x,
                y1: globalPoint.y,
            } as Partial<this>);
        } else if (p === this.k2) {
            this.set({
                x2: globalPoint.x,
                y2: globalPoint.y,
            } as Partial<this>);
        }
    }

    updateAll(transformMatrix: number[]) {
        this.update(this.k1, transformMatrix);
        this.update(this.k2, transformMatrix);
    }

    updateVisibility() {
        this.visible = this.k1._visible && this.k2._visible;
    }

    get length(): number {
        return this.k1.distanceTo(this.k2);
    }
};


class OpenposeObject {
    keypoints: OpenposeKeypoint2D[];
    connections: OpenposeConnection[];
    visible: boolean;
    group: fabric.Group | undefined;
    canvas: fabric.Canvas | undefined;

    constructor(keypoints: OpenposeKeypoint2D[], connections: OpenposeConnection[]) {
        this.keypoints = keypoints;
        this.connections = connections;
        this.visible = true;
        this.group = undefined;
        this.canvas = undefined;

        // Negative x, y means invalid keypoint.
        this.keypoints.forEach(keypoint => {
            keypoint._visible = keypoint.x >= 0 && keypoint.y >= 0 && keypoint.confidence === 1.0;
        });
    }

    addToCanvas(canvas: fabric.Canvas) {
        this.keypoints.forEach(p => canvas.add(p));
        this.connections.forEach(c => canvas.add(c));
        this.canvas = canvas;
    }

    removeFromCanvas(canvas: fabric.Canvas) {
        this.keypoints.forEach(p => canvas.remove(p));
        this.connections.forEach(c => canvas.remove(c));
        if (this.grouped) {
            canvas.remove(this.group!);
        }
        this.canvas = undefined;
    }

    serialize(): number[] {
        return _.flatten(this.keypoints.map(p => p._visible ? [p.x, p.y, 1.0] : [0.0, 0.0, 0.0]));
    }

    makeGroup() {
        if (this.group !== undefined)
            return;
        if (this.canvas === undefined)
            throw 'Cannot group object as the object is not on canvas yet. Call `addToCanvas` first.'

        const objects = [...this.keypoints, ...this.connections];

        // Get all the objects as selection
        var sel = new fabric.ActiveSelection(objects, {
            canvas: this.canvas,
            lockScalingX: true,
            lockScalingY: true,
            opacity: _.mean(objects.map(o => o.opacity)),
        });

        // Make the objects active
        this.canvas.setActiveObject(sel);

        // Group the objects
        this.group = sel.toGroup();
    }

    ungroup() {
        if (this.group === undefined)
            return;
        if (this.canvas === undefined)
            throw 'Cannot group object as the object is not on canvas yet. Call `addToCanvas` first.';

        this.group.toActiveSelection();
        this.group = undefined;
        this.canvas.discardActiveObject();

        // Need to refresh every connection, as their coords information are outdated once ungrouped
        this.connections.forEach(c => {
            // The scale applied on the group will also apply on each connection. Reset
            // the scaling factor to 1 when ungrouping so that connection's behaviour 
            // do not change.
            c.set({
                scaleX: 1.0,
                scaleY: 1.0,
            });
            c.updateAll(IDENTITY_MATRIX);
        });
    }

    set grouped(grouped: boolean) {
        if (this.grouped === grouped) {
            return;
        }

        if (grouped) {
            this.makeGroup();
        } else {
            this.ungroup();
        }
    }

    get grouped(): boolean {
        return this.group !== undefined;
    }
};

function formatColor(color: [number, number, number]): string {
    return `rgb(${color.join(", ")})`;
}

class OpenposeBody extends OpenposeObject {
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
        /* Coco format has 18 keypoints. */
        if (rawKeypoints.length != 18) {
            throw `Wrong number of keypoints for openpose body(Coco format). Expect 18 but got ${rawKeypoints.length}.`
        }

        const keypoints = _.zipWith(rawKeypoints, OpenposeBody.colors, OpenposeBody.keypoint_names,
            (p, color, keypoint_name) => new OpenposeKeypoint2D(
                p[0],
                p[1],
                p[2],
                formatColor(color),
                keypoint_name,
                /* opacity= */ 0.7
            ));

        const connections = _.zipWith(OpenposeBody.keypoints_connections, OpenposeBody.colors.slice(0, 17),
            (connection, color) => {
                return new OpenposeConnection(
                    keypoints[connection[0]],
                    keypoints[connection[1]],
                    formatColor(color),
                    /* opacity= */ 0.7
                );
            });

        super(keypoints, connections);
    }

    getKeypointByName(name: string): OpenposeKeypoint2D {
        const index = OpenposeBody.keypoint_names.findIndex(s => s === name);
        if (index === -1) {
            throw `'${name}' not found in keypoint names.`;
        }
        return this.keypoints[index];
    }
};

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    let r: number, g: number, b: number;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;
        case 1:
            r = q;
            g = v;
            b = p;
            break;
        case 2:
            r = p;
            g = v;
            b = t;
            break;
        case 3:
            r = p;
            g = q;
            b = v;
            break;
        case 4:
            r = t;
            g = p;
            b = v;
            break;
        case 5:
            r = v;
            g = p;
            b = q;
            break;
    }

    return [Math.round(r! * 255), Math.round(g! * 255), Math.round(b! * 255)];
}
class OpenposeHand extends OpenposeObject {
    static keypoint_connections: [number, number][] = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
    ];

    static keypoint_names: string[] = [
        'wrist joint',
        ..._.range(4).map(i => `Thumb-${i}`),
        ..._.range(4).map(i => `Index Finger-${i}`),
        ..._.range(4).map(i => `Middle Finger-${i}`),
        ..._.range(4).map(i => `Ring Finger-${i}`),
        ..._.range(4).map(i => `Little Finger-${i}`),
    ];

    constructor(rawKeypoints: [number, number, number][]) {
        const keypoints = _.zipWith(rawKeypoints, OpenposeHand.keypoint_names,
            (rawKeypoint: [number, number, number], name: string) => new OpenposeKeypoint2D(
                rawKeypoint[0] > 0 ? rawKeypoint[0] : -1,
                rawKeypoint[1] > 0 ? rawKeypoint[1] : -1,
                rawKeypoint[2],
                formatColor([0, 0, 255]), // All hand keypoints are marked blue.
                name
            ));

        const connections = OpenposeHand.keypoint_connections.map((connection, i) => new OpenposeConnection(
            keypoints[connection[0]],
            keypoints[connection[1]],
            formatColor(hsvToRgb(i / OpenposeHand.keypoint_connections.length, 1.0, 1.0))
        ));
        super(keypoints, connections);
    }

    /**
     * Size of a hand is calculated as the average connection distance 
     * (all visible connections).
     */
    get size(): number {
        return _.mean(this.connections.filter(c => c.visible).map(c => c.length));
    }
};

class OpenposeFace extends OpenposeObject {
    constructor(rawKeypoints: [number, number, number][]) {
        const keypoints = rawKeypoints.map((rawKeypoint, i) => new OpenposeKeypoint2D(
            rawKeypoint[0] > 0 ? rawKeypoint[0] : -1,
            rawKeypoint[1] > 0 ? rawKeypoint[1] : -1,
            rawKeypoint[2],
            formatColor([255, 255, 255]),
            `FaceKeypoint-${i}`
        ));
        super(keypoints, []);
    }
}

class OpenposePerson {
    static id = 0;

    name: string;
    body: OpenposeBody;
    left_hand: OpenposeHand | undefined;
    right_hand: OpenposeHand | undefined;
    face: OpenposeFace | undefined;
    id: number;
    visible: boolean;

    constructor(name: string | null, body: OpenposeBody,
        left_hand: OpenposeHand | undefined = undefined,
        right_hand: OpenposeHand | undefined = undefined,
        face: OpenposeFace | undefined = undefined
    ) {
        this.body = body;
        this.left_hand = left_hand;
        this.right_hand = right_hand;
        this.face = face;
        this.id = OpenposePerson.id++;
        this.visible = true;
        this.name = name == null ? `Person ${this.id}` : name;
    }

    addToCanvas(canvas: fabric.Canvas) {
        [this.body, this.left_hand, this.right_hand, this.face].forEach(o => o?.addToCanvas(canvas));
    }

    removeFromCanvas(canvas: fabric.Canvas) {
        [this.body, this.left_hand, this.right_hand, this.face].forEach(o => o?.removeFromCanvas(canvas));
    }

    allKeypoints(): OpenposeKeypoint2D[] {
        return _.flatten([this.body, this.left_hand, this.right_hand, this.face]
            .map(o => o === undefined ? [] : o.keypoints));
    }

    toJson(): IOpenposePersonJson {
        return {
            pose_keypoints_2d: this.body.serialize(),
            hand_right_keypoints_2d: this.right_hand?.serialize(),
            hand_left_keypoints_2d: this.left_hand?.serialize(),
            face_keypoints_2d: this.face?.serialize(),
        } as IOpenposePersonJson;
    }

    private adjustHandSize(hand: OpenposeHand, wrist_keypoint: OpenposeKeypoint2D, elbow_keypoint: OpenposeKeypoint2D) {
        hand.grouped = true;
        // Scale the hand to fit body size
        const forearm_length = wrist_keypoint.distanceTo(elbow_keypoint);
        const hand_length = hand.size * 4; // There are 4 connections from wrist_joint to any fingertips.
        let scaleRatio = forearm_length / hand_length;
        hand.group!.scale(scaleRatio);
    }

    private adjustHandAngle(hand: OpenposeHand, wrist_keypoint: OpenposeKeypoint2D, elbow_keypoint: OpenposeKeypoint2D) {
        // Ungroup the hand
        hand.grouped = false;

        // Calculate the angle
        const initial_angle = fabric.util.degreesToRadians(90);
        const angle = Math.atan2(
            elbow_keypoint.abs_y - wrist_keypoint.abs_y,
            elbow_keypoint.abs_x - wrist_keypoint.abs_x
        );

        // Rotate each keypoint
        hand.keypoints.forEach(keypoint => {
            // Create a point for the current keypoint
            const point = new fabric.Point(keypoint.x, keypoint.y);

            // Create a point for the wrist (the rotation origin)
            const origin = new fabric.Point(wrist_keypoint.x, wrist_keypoint.y);

            // Rotate the point
            const rotatedPoint = fabric.util.rotatePoint(point, origin, angle - initial_angle);

            // Update the keypoint coordinates
            keypoint.x = rotatedPoint.x;
            keypoint.y = rotatedPoint.y;
        });

        // Update each connection
        hand.connections.forEach(connection => connection.updateAll(IDENTITY_MATRIX));
    }

    private adjustHandLocation(hand: OpenposeHand, wrist_keypoint: OpenposeKeypoint2D, elbow_keypoint: OpenposeKeypoint2D) {
        hand.grouped = true;
        // Move the group so that the wrist joint is at the wrist keypoint
        const wrist_joint = hand.keypoints[0]; // Assuming the wrist joint is the first keypoint
        let dx = wrist_keypoint.abs_x - wrist_joint.abs_x;
        let dy = wrist_keypoint.abs_y - wrist_joint.abs_y;
        hand.group!.left! += dx;
        hand.group!.top! += dy;
    }

    private adjustHand(hand: OpenposeHand, wrist_keypoint: OpenposeKeypoint2D, elbow_keypoint: OpenposeKeypoint2D) {
        this.adjustHandSize(hand, wrist_keypoint, elbow_keypoint);
        this.adjustHandAngle(hand, wrist_keypoint, elbow_keypoint);
        this.adjustHandLocation(hand, wrist_keypoint, elbow_keypoint);
        // Update group coordinates
        hand.group!.setCoords();
    }

    public attachLeftHand(hand: OpenposeHand) {
        this.adjustHand(hand, this.body.getKeypointByName('left_wrist'), this.body.getKeypointByName('left_elbow'));
        this.left_hand = hand;
    }

    public attachRightHand(hand: OpenposeHand) {
        this.adjustHand(hand, this.body.getKeypointByName('right_wrist'), this.body.getKeypointByName('right_elbow'));
        this.right_hand = hand;
    }
};

interface IOpenposePersonJson {
    pose_keypoints_2d: number[],
    hand_right_keypoints_2d: number[] | null,
    hand_left_keypoints_2d: number[] | null,
    face_keypoints_2d: number[] | null,
};

interface IOpenposeJson {
    canvas_width: number;
    canvas_height: number;
    people: IOpenposePersonJson[];
};

export {
    OpenposeBody,
    OpenposeConnection,
    OpenposeKeypoint2D,
    OpenposeObject,
    OpenposePerson,
    OpenposeHand,
    OpenposeFace,
};

export type {
    IOpenposeJson
};
