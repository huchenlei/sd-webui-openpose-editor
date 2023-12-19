import { toRaw, markRaw } from 'vue';
import { fabric } from 'fabric';
import _ from 'lodash';

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

class OpenposeKeypoint2D extends fabric.Circle {
    static idCounter: number = 0;
    id: number;
    confidence: number;
    name: string;
    connections: Array<OpenposeConnection>;
    selected: boolean;
    selected_in_group: boolean;
    constant_radius: number;

    constructor(
        x: number, y: number, confidence: number, color: string, name: string,
        opacity: number = 1.0, constant_radius: number = 2
    ) {
        super({
            radius: constant_radius,
            left: x,
            top: y,
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
        this.selected = false;
        this.selected_in_group = false;
        this.constant_radius = constant_radius;

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
            super._set('skewX', 0);
            super._set('skewY', 0);
            super._set('flipX', false);
            super._set('flipY', false);
        } else {
            super._set(key, value);
        }
        return this;
    }

    _maintainConstantRadius(): void {
        this.set('radius', this.constant_radius);
        this.setCoords();
    }

    get x(): number {
        return this.left!;
    }

    set x(x: number) {
        this.left = x;
    }

    get y(): number {
        return this.top!;
    }

    set y(y: number) {
        this.top = y;
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

    swap(other: OpenposeKeypoint2D): void {
        const otherX = other.x;
        const otherY = other.y;

        other.x = this.x;
        other.y = this.y;

        this.x = otherX;
        this.y = otherY;

        this.setCoords();
        other.setCoords();
    }
};

class OpenposeConnection extends fabric.Line {
    k1: OpenposeKeypoint2D;
    k2: OpenposeKeypoint2D;

    constructor(
        k1: OpenposeKeypoint2D, k2: OpenposeKeypoint2D, color: string,
        opacity: number = 1.0, strokeWidth: number = 2
    ) {
        super([k1.x, k1.y, k2.x, k2.y], {
            fill: color,
            stroke: color,
            strokeWidth,
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
        this.updateAll(IDENTITY_MATRIX);
    }

    /**
     * Update the connection because the coords of any of the keypoints has 
     * changed. 
     */
    update(p: OpenposeKeypoint2D, transformMatrix: number[]) {
        const rawGlobalPoint = fabric.util.transformPoint(
            p.getCenterPoint(),
            transformMatrix
        );
        const globalPoint = new fabric.Point(
            rawGlobalPoint.x - p.constant_radius / 4,
            rawGlobalPoint.y - p.constant_radius / 4
        );
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
    _locked: boolean;
    canvas: fabric.Canvas | undefined;
    openposeCanvas: fabric.Rect | undefined;

    // If the object is symmetrical, it should be flippable.
    flippable: boolean = false;

    constructor(keypoints: OpenposeKeypoint2D[], connections: OpenposeConnection[]) {
        this.keypoints = keypoints;
        this.connections = connections;
        this.visible = true;
        this.group = undefined;
        this._locked = false;
        this.canvas = undefined;
        this.openposeCanvas = undefined;

        // Negative x, y means invalid keypoint.
        this.keypoints.forEach(keypoint => {
            keypoint._visible = this.isKeypointValid(keypoint) && keypoint.confidence === 1.0;
        });
    }

    isKeypointValid(keypoint: OpenposeKeypoint2D): boolean {
        let offsetX = 0;
        let offsetY = 0;
        if (this.openposeCanvas !== undefined) {
            offsetX = this.openposeCanvas?.left!;
            offsetY = this.openposeCanvas?.top!;
        };
        return keypoint.abs_x - offsetX > 0 && keypoint.abs_y - offsetY > 0;
    }

    invalidKeypoints(): OpenposeKeypoint2D[] {
        return this.keypoints.filter(keypoint => !this.isKeypointValid(keypoint) && !keypoint._visible);
    }

    hasInvalidKeypoints(): boolean {
        return this.invalidKeypoints().length > 0;
    }

    addToCanvas(openposeCanvas: fabric.Rect) {
        this.canvas = openposeCanvas.canvas;
        this.openposeCanvas = openposeCanvas;

        this.keypoints.forEach(p => {
            p.x += openposeCanvas.left!;
            p.y += openposeCanvas.top!;
            this.canvas?.add(p);
            p.updateConnections(IDENTITY_MATRIX);
        });

        this.connections.forEach(c => {
            this.canvas?.add(c)
        });
    }

    removeFromCanvas() {
        this.keypoints.forEach(p => this.canvas?.remove(toRaw(p)));
        this.connections.forEach(c => this.canvas?.remove(toRaw(c)));
        if (this.grouped) {
            this.canvas?.remove(toRaw(this.group!));
        }
        this.canvas = undefined;
    }

    serialize(): number[] {
        const openposeCanvas = this.openposeCanvas;

        if (openposeCanvas === undefined)
            return [];

        return _.flatten(this.keypoints.map(p =>
            p._visible ? [
                p.abs_x - openposeCanvas.left!,
                p.abs_y - openposeCanvas.top!,
                1.0
            ] : [0.0, 0.0, 0.0]
        ));
    }

    makeGroup() {
        if (this.group !== undefined)
            return;
        if (this.canvas === undefined)
            throw 'Cannot group object as the object is not on canvas yet. Call `addToCanvas` first.'

        const objects = [...this.keypoints, ...this.connections].map(o => toRaw(o));

        // Get all the objects as selection
        const sel = new fabric.ActiveSelection(objects, {
            canvas: this.canvas,
            lockScalingX: true,
            lockScalingY: true,
            opacity: _.mean(objects.map(o => o.opacity)),
            visible: this.visible,
        });

        // Make the objects active
        this.canvas.setActiveObject(sel);

        // Group the objects
        this.group = markRaw(sel.toGroup());
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
            // The scale/rotation/skew applied on the group will also apply on each connection. 
            // Reset everything to 1 when ungrouping so that connection's behaviour 
            // do not change.
            c.set({
                scaleX: 1.0,
                scaleY: 1.0,
                angle: 0,
                skewX: 0,
                skewY: 0,
                flipX: false,
                flipY: false,
            });
            c.updateAll(IDENTITY_MATRIX);
        });
    }

    set grouped(grouped: boolean) {
        if (this.grouped === grouped || this.locked) {
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

    lockObject() {
        this.grouped = true;
        this.group!.set({
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
        });
        this._locked = true;
    }

    unlockObject() {
        this.grouped = true;
        this.group!.set({
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
        });
        this._locked = false;
    }

    set locked(locked: boolean) {
        if (this.locked === locked) return;

        if (locked) {
            this.lockObject();
        } else {
            this.unlockObject();
        }
    }

    get locked() {
        return this._locked;
    }

    flip() {
        if (!this.flippable) {
            throw "The object is not flippable.";
        }

        const nameMap = _.keyBy(this.keypoints, 'name');

        this.keypoints.forEach(keypoint => {
            const counterpart: OpenposeKeypoint2D | undefined =
                nameMap[keypoint.name.replace('left', 'right')];

            if (keypoint.name.startsWith('left') && counterpart !== undefined) {
                keypoint.swap(counterpart);
                keypoint.updateConnections(IDENTITY_MATRIX);
                counterpart.updateConnections(IDENTITY_MATRIX);
            }
        });
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
        const keypoints = _.zipWith(rawKeypoints, OpenposeBody.colors, OpenposeBody.keypoint_names,
            (p, color, keypoint_name) => new OpenposeKeypoint2D(
                p[0],
                p[1],
                p[2],
                formatColor(color),
                keypoint_name,
                /* opacity= */ 0.7,
                /* constant_radius= */ 4
            ));

        const connections = _.zipWith(OpenposeBody.keypoints_connections, OpenposeBody.colors.slice(0, 17),
            (connection, color) => {
                return new OpenposeConnection(
                    keypoints[connection[0]],
                    keypoints[connection[1]],
                    formatColor(color),
                    /* opacity= */ 0.7,
                    /* strokeWidth= */ 4
                );
            });

        super(keypoints, connections);
        this.flippable = true;
    }

    static create(rawKeypoints: [number, number, number][]): OpenposeBody | undefined {
        if (rawKeypoints.length < OpenposeBody.keypoint_names.length) {
            console.warn(
                `Wrong number of keypoints for openpose body(Coco format). 
                Expect ${OpenposeBody.keypoint_names.length} but got ${rawKeypoints.length}.`)
            return undefined;
        }
        rawKeypoints.slice(0, OpenposeBody.keypoint_names.length);
        return new OpenposeBody(rawKeypoints);
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

    static create(rawKeypoints: [number, number, number][]): OpenposeHand | undefined {
        if (rawKeypoints.length < OpenposeHand.keypoint_names.length) {
            console.warn(
                `Wrong number of keypoints for openpose hand. Expect ${OpenposeHand.keypoint_names.length} but got ${rawKeypoints.length}.`)
            return undefined;
        }
        rawKeypoints.slice(0, OpenposeHand.keypoint_names.length);
        return new OpenposeHand(rawKeypoints);
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
    static keypoint_names: string[] = [
        ..._.range(17).map(i => `FaceOutline-${i}`),
        ..._.range(5).map(i => `LeftEyebrow-${i}`),
        ..._.range(5).map(i => `RightEyebrow-${i}`),
        ..._.range(4).map(i => `NoseBridge-${i}`),
        ..._.range(5).map(i => `NoseBottom-${i}`),
        ..._.range(6).map(i => `LeftEyeOutline-${i}`),
        ..._.range(6).map(i => `RightEyeOutline-${i}`),
        ..._.range(12).map(i => `MouthOuterBound-${i}`),
        ..._.range(8).map(i => `MouthInnerBound-${i}`),
        'LeftEyeball',
        'RightEyeball',
    ];

    constructor(rawKeypoints: [number, number, number][]) {
        const keypoints = _.zipWith(rawKeypoints, OpenposeFace.keypoint_names,
            (rawKeypoint, name) => new OpenposeKeypoint2D(
                rawKeypoint[0] > 0 ? rawKeypoint[0] : -1,
                rawKeypoint[1] > 0 ? rawKeypoint[1] : -1,
                rawKeypoint[2],
                formatColor([255, 255, 255]),
                name
            ));
        super(keypoints, []);
    }

    static create(rawKeypoints: [number, number, number][]): OpenposeFace | undefined {
        if (rawKeypoints.length < OpenposeFace.keypoint_names.length) {
            console.warn(
                `Wrong number of keypoints for openpose face. Expect ${OpenposeFace.keypoint_names.length} but got ${rawKeypoints.length}.`)
            return undefined;
        }
        rawKeypoints.slice(0, OpenposeFace.keypoint_names.length);
        return new OpenposeFace(rawKeypoints);
    }
}

enum OpenposeBodyPart {
    LEFT_HAND = 'left_hand',
    RIGHT_HAND = 'right_hand',
    FACE = 'face',
};

class OpenposePerson {
    static id = 0;

    name: string;
    body: OpenposeBody | OpenposeAnimal;
    left_hand: OpenposeHand | undefined;
    right_hand: OpenposeHand | undefined;
    face: OpenposeFace | undefined;
    id: number;
    visible: boolean;

    constructor(name: string | null, body: OpenposeBody | OpenposeAnimal,
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

    get isAnimal(): boolean {
        return this.body instanceof OpenposeAnimal;
    }

    addToCanvas(openposeCanvas: fabric.Rect) {
        [this.body, this.left_hand, this.right_hand, this.face].forEach(o => o?.addToCanvas(openposeCanvas));
    }

    removeFromCanvas() {
        [this.body, this.left_hand, this.right_hand, this.face].forEach(o => o?.removeFromCanvas());
    }

    allKeypoints(): OpenposeKeypoint2D[] {
        return _.flatten([this.body, this.left_hand, this.right_hand, this.face]
            .map(o => o === undefined ? [] : o.keypoints));
    }

    allKeypointsInvisible(): boolean {
        return _.every(this.allKeypoints(), keypoint => !keypoint._visible);
    }

    toJson(): IOpenposePersonJson | number[] {
        if (this.isAnimal) {
            return this.body.serialize();
        }
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
        // Approximate hand size as 70% of forearm length.
        const scaleRatio = forearm_length * 0.7 / hand_length;
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
        const dx = wrist_keypoint.abs_x - wrist_joint.abs_x;
        const dy = wrist_keypoint.abs_y - wrist_joint.abs_y;
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
        if (!(this.body instanceof OpenposeBody)) {
            throw "Hand not supported for OpenposeAnimal.";
        }
        this.adjustHand(hand, this.body.getKeypointByName('left_wrist'), this.body.getKeypointByName('left_elbow'));
        this.left_hand = hand;
    }

    public attachRightHand(hand: OpenposeHand) {
        if (!(this.body instanceof OpenposeBody)) {
            throw "Hand not supported for OpenposeAnimal.";
        }
        this.adjustHand(hand, this.body.getKeypointByName('right_wrist'), this.body.getKeypointByName('right_elbow'));
        this.right_hand = hand;
    }

    public attachFace(face: OpenposeFace) {
        // TODO: adjust face location.
        this.face = face;
    }
};

class OpenposeAnimal extends OpenposeObject {
    // Note: the index here is from 1. So we need to shift -1 to get 0-indexed connections.
    static keypoint_connections: [number, number][] = [
        [1, 2],
        [2, 3],
        [1, 3],
        [3, 4],
        [4, 9],
        [9, 10],
        [10, 11],
        [4, 6],
        [6, 7],
        [7, 8],
        [4, 5],
        [5, 15],
        [15, 16],
        [16, 17],
        [5, 12],
        [12, 13],
        [13, 14],
    ];

    static colors: [number, number, number][] = [
        [255, 255, 255],
        [100, 255, 100],
        [150, 255, 255],
        [100, 50, 255],
        [50, 150, 200],
        [0, 255, 255],
        [0, 150, 0],
        [0, 0, 255],
        [0, 0, 150],
        [255, 50, 255],
        [255, 0, 255],
        [255, 0, 0],
        [150, 0, 0],
        [255, 255, 100],
        [0, 150, 0],
        [255, 255, 0],
        [150, 150, 150],
    ];

    static keypoint_names: string[] = Array.from(Array(17).keys()).map(i => `Keypoint-${i}`);

    constructor(rawKeypoints: [number, number, number][]) {
        console.log(OpenposeAnimal.keypoint_names);
        const keypoints = _.zipWith(rawKeypoints, OpenposeAnimal.colors, OpenposeAnimal.keypoint_names,
            (p, color, name) => new OpenposeKeypoint2D(
                p[0],
                p[1],
                p[2] > 0 ? 1.0 : 0.0,
                formatColor(color),
                name,
                /* opacity= */ 1.0,
                /* constant_radius= */ 2
            ));

        const connections = _.zipWith(OpenposeAnimal.keypoint_connections, OpenposeAnimal.colors.slice(0, 17),
            (connection, color) => {
                return new OpenposeConnection(
                    keypoints[connection[0] - 1],
                    keypoints[connection[1] - 1],
                    formatColor(color),
                    /* opacity= */ 1.0,
                    /* strokeWidth= */ 4
                );
            });

        super(keypoints, connections);
        this.flippable = true;
    }

    static create(rawKeypoints: [number, number, number][]): OpenposeAnimal | undefined {
        if (rawKeypoints.length < OpenposeAnimal.keypoint_names.length) {
            console.warn(
                `Wrong number of keypoints for openpose body(Coco format). 
                Expect ${OpenposeBody.keypoint_names.length} but got ${rawKeypoints.length}.`)
            return undefined;
        }
        rawKeypoints.slice(0, OpenposeAnimal.keypoint_names.length);
        return new OpenposeAnimal(rawKeypoints);
    }
}

interface IOpenposePersonJson {
    pose_keypoints_2d: number[],
    hand_right_keypoints_2d: number[] | null,
    hand_left_keypoints_2d: number[] | null,
    face_keypoints_2d: number[] | null,
};

interface IOpenposeJson {
    canvas_width: number;
    canvas_height: number;
    people: IOpenposePersonJson[] | undefined;
    animals: number[][] | undefined;
};

export {
    OpenposeBody,
    OpenposeConnection,
    OpenposeKeypoint2D,
    OpenposeObject,
    OpenposePerson,
    OpenposeHand,
    OpenposeFace,
    OpenposeBodyPart,
    OpenposeAnimal,
};

export type {
    IOpenposeJson
};
