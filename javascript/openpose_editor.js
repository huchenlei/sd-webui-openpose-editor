/* See http://fabricjs.com/ for more information on fabric canvas API. */
fabric.Object.prototype.transparentCorners = false;
fabric.Object.prototype.cornerColor = '#108ce6';
fabric.Object.prototype.borderColor = '#108ce6';
fabric.Object.prototype.cornerSize = 10;
fabric.Object.prototype.lockRotation = true;

class OpenposeEditor {
    /**
     * @param {HTMLElement} canvasElem The HTML canvas element to be used as the OpenposeEditor.
     */
    constructor(canvasElem) {
        this.canvas = new fabric.Canvas(canvasElem, {
            backgroundColor: '#000',
            preserveObjectStacking: true
        });
        this.people = [];
        this.registerEventHandlers();
    }

    registerEventHandlers() {
        this.canvas.on('object:moving', (event) => {
            const keypoint = event.target;
            
            let selectedKeypoints = new Set();
            selectedKeypoints.add(keypoint);
            if (selectedKeypoints.has(keypoint)) {
                // Calculate the movement delta for the selected keypoint 
                const deltaX = keypoint.left - keypoint.aCoords.tl.x;
                const deltaY = keypoint.top - keypoint.aCoords.tl.y;

                // Move all other selected vertices by the same delta
                selectedKeypoints.forEach((selectedKeypoint) => {
                    if (selectedKeypoint !== keypoint) {
                        selectedKeypoint.set({
                            left: selectedKeypoint.left + deltaX,
                            top: selectedKeypoint.top + deltaY,
                        });
                    }
                });

                // Update all connections.
                selectedKeypoints.forEach((selectedKeypoint) => {
                    selectedKeypoint.handle.connections.forEach((connection) => {
                        connection.pushUpdateToCanvas();
                    });
                });
            }
        });
    }

    addPerson(person) {
        this.people.push(person);
        person.addToCanvas(this.canvas);
        this.canvas.requestRenderAll();
    }
};

class OpenposePerson {
    /**
     * @param {OpenposeBody} body 
     * @param {Array<OpenposeHand>} hands 
     * @param {OpenposeFace} face 
     */
    constructor(body, hands, face) {
        this.body = body;
        this.hands = hands;
        this.face = face;
    }

    /**
     * Add the person to the canvas.
     * @param {fabric.Canvas} canvas 
     */
    addToCanvas(canvas) {
        const selectionList = [];
        this.body.addToCanvas(canvas, selectionList);
        this.hands.forEach(hand => hand.addToCanvas(canvas, selectionList));
        this.face.addToCanvas(canvas, selectionList);
        
        const activeSelection = new fabric.ActiveSelection(selectionList, {canvas: canvas});
        canvas.discardActiveObject();
        canvas.setActiveObject(activeSelection);
        canvas.selection = true;
    }
};

class OpenposeKeypoint2D {
    constructor(x, y, confidence, color, name) {
        this.confidence = confidence;
        this.name = name;
        this.connections = [];

        const radius = 2;
        this.circle = new fabric.Circle({
            handle: this,
            radius: radius,
            left: x - radius,
            top: y - radius,
            fill: color,
            stroke: color,
            strokeWidth: 1,
            hasControls: false, // Disallow user to scale the keypoint circle.
            hasBorders: false,
        });
    }

    addConnection(connection) {
        this.connections.push(connection);
    }

    addToCanvas(canvas, selectionList) {
        canvas.add(this.circle);
        selectionList.push(this.circle);
    }

    getX() {
        return this.circle.left + this.circle.radius;
    }

    getY() {
        return this.circle.top + this.circle.radius;
    }

    getColor() {
        return this.circle.fill;
    }

    setColor(color) {
        this.circle.fill = color;
        this.circle.stroke = color;
    }
};

/**
 * Connection between 2 keypoints. Direction matters. The color of connection will be applied to k2.
 */
class OpenposeConnection {
    constructor(k1, k2, color) {
        this.k1 = k1;
        this.k2 = k2;

        this.k1.addConnection(this);
        this.k2.addConnection(this);
        this.line = new fabric.Line([this.k1.getX(), this.k1.getY(), this.k2.getX(), this.k2.getY()], {
            handle: this,
            fill: color,
            stroke: color,
            strokeWidth: 2,
            // Connections(Edges) themselves are not selectable, they will adjust when relevant keypoints move.
            selectable: false,
            // Connections should not appear in events.
            evented: false,
        });
    }

    addToCanvas(canvas, selectionList) {
        // We don't want lines to be selected so not adding line into selectionList.
        canvas.add(this.line);
    }

    pushUpdateToCanvas() {
        this.line.set({ x1: this.k1.getX(), y1: this.k1.getY() });
        this.line.set({ x2: this.k2.getX(), y2: this.k2.getY() });
    }
}

class OpenposeObject {
    constructor(keypoints, connections) {
        this.keypoints = keypoints;
        this.connections = connections;
    }

    addToCanvas(canvas, selectionList) {
        this.keypoints.forEach(p => p.addToCanvas(canvas, selectionList));
        this.connections.forEach(c => c.addToCanvas(canvas, selectionList));
    }
};

class OpenposeBody extends OpenposeObject {
    static keypoints_connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [1, 5], [5, 6], [6, 7], [1, 8],
        [8, 9], [9, 10], [1, 11], [11, 12],
        [12, 13], [0, 14], [14, 16], [0, 15],
        [15, 17],
    ];
    static connection_colors = [
        [0, 0, 255], [255, 0, 0], [255, 170, 0], [255, 255, 0],
        [255, 85, 0], [170, 255, 0], [85, 255, 0], [0, 255, 0],
        [0, 255, 85], [0, 255, 170], [0, 255, 255], [0, 170, 255],
        [0, 85, 255], [85, 0, 255], [170, 0, 255], [255, 0, 255],
        [255, 0, 170], [255, 0, 85],
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
    constructor(rawKeypoints) {
        super(...OpenposeBody.createKeypointsAndConnections(rawKeypoints));
    }

    static createKeypointsAndConnections(rawKeypoints) {
        /* Coco format has 18 keypoints. */
        if (rawKeypoints.length != 18) {
            console.error(`Wrong number of keypoints for openpose body(Coco format). Expect 18 but got ${keypoints.length}.`);
            return [[], []];
        }

        const keypoints = rawKeypoints.map((p, i) => new OpenposeKeypoint2D(
            p[0],
            p[1],
            p.length >= 3 ? p[2] : 1.0, // confidence.
            null, // color.
            OpenposeBody.keypoint_names[i]
        ));

        const connections = OpenposeBody.keypoints_connections.map((connection, i) => {
            const k1 = keypoints[connection[0]];
            const k2 = keypoints[connection[1]];
            const color = `rgba(${OpenposeBody.connection_colors[i].join(", ")}, 0.7)`;

            if (k1.getColor == null) {
                k1.setColor(color);
            }
            k2.setColor(color)

            return new OpenposeConnection(k1, k2, color);
        });

        return [keypoints, connections];
    }
};

class OpenposeHand extends OpenposeObject {
    constructor() {
        super([], []);
    }
};

class OpenposeFace extends OpenposeObject {
    constructor() {
        super([], []);
    }
};

window.addEventListener('DOMContentLoaded', () => {
    const default_keypoints = [[241, 77], [241, 120], [191, 118], [177, 183], [163, 252], [298, 118], [317, 182], [332, 245], [225, 241], [213, 359], [215, 454], [270, 240], [282, 360], [286, 456], [232, 59], [253, 60], [225, 70], [260, 72]];
    const observer = new MutationObserver((m) => {
        const canvasElem = gradioApp().querySelector('#cnet-openpose-editor');
        if (canvasElem) {
            const editor = new OpenposeEditor(canvasElem);
            editor.addPerson(new OpenposePerson(new OpenposeBody(default_keypoints), [], new OpenposeFace()));
            observer.disconnect();
        }
    });
    observer.observe(gradioApp(), { childList: true, subtree: true });
});
