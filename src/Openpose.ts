import { fabric } from 'fabric';
import _ from 'lodash';

class OpenposeKeypoint2D extends fabric.Circle {
    static radius: number = 2;
    static idCounter: number = 0;
    id: number;
    confidence: number;
    name: string;
    connections: Array<OpenposeConnection>;
    selected_in_group : boolean;

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
            visible: true,
        });

        this.confidence = confidence;
        this.name = name;
        this.connections = [];
        this.id = OpenposeKeypoint2D.idCounter++;
        this.selected_in_group = false;
    }

    addConnection(connection: OpenposeConnection): void {
        this.connections.push(connection);
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
            c.visible = visible;
        });
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

    /**
     * Update the connection because the coords of any of the keypoints has 
     * changed. 
     */
    update(p: OpenposeKeypoint2D, origin: fabric.Point) {
        if (p === this.k1) {
            this.set({
                x1: this.k1.x + origin.x,
                y1: this.k1.y + origin.y,
            } as Partial<this>);
        } else if (p === this.k2) {
            this.set({
                x2: this.k2.x + origin.x,
                y2: this.k2.y + origin.y,
            } as Partial<this>);
        }
    }
};

class OpenposeObject {
    keypoints: OpenposeKeypoint2D[];
    connections: OpenposeConnection[];

    constructor(keypoints: OpenposeKeypoint2D[], connections: OpenposeConnection[]) {
        this.keypoints = keypoints;
        this.connections = connections;
    }

    addToCanvas(canvas: fabric.Canvas) {
        this.keypoints.forEach(p => canvas.add(p));
        this.connections.forEach(c => canvas.add(c));
    }

    removeFromCanvas(canvas: fabric.Canvas) {
        this.keypoints.forEach(p => canvas.remove(p));
        this.connections.forEach(c => canvas.remove(c));
    }

};

function formatColor(color: [number, number, number], opacity: number = 1.0): string {
    return `rgba(${color.join(", ")}, ${opacity})`;
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
                formatColor(color, 0.7),
                keypoint_name
            ));

        const connections = _.zipWith(OpenposeBody.keypoints_connections, OpenposeBody.colors.slice(0, 17),
            (connection, color) => {
                return new OpenposeConnection(
                    keypoints[connection[0]],
                    keypoints[connection[1]],
                    formatColor(color, 0.7)
                );
            });

        super(keypoints, connections);
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

    constructor(rawKeypoints: [number, number, number][]) {
        const keypoints = rawKeypoints.map((rawKeypoint, i) => new OpenposeKeypoint2D(
            rawKeypoint[0],
            rawKeypoint[1],
            rawKeypoint[2],
            formatColor([0, 0, 255]), // All hand keypoints are marked blue.
            `HandKeypoint-${i}`
        ));

        const connections = OpenposeHand.keypoint_connections.map((connection, i) => new OpenposeConnection(
            keypoints[connection[0]],
            keypoints[connection[1]],
            formatColor(hsvToRgb(i / OpenposeHand.keypoint_connections.length, 1.0, 1.0))
        ));
        super(keypoints, connections);
    }
};

class OpenposeFace extends OpenposeObject {
    constructor(rawKeypoints: [number, number, number][]) {
        const keypoints = rawKeypoints.map((rawKeypoint, i) => new OpenposeKeypoint2D(
            rawKeypoint[0],
            rawKeypoint[1],
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
