// canvas.js — manages local drawing, coordinate math, and rendering layers

export const stage = document.getElementById('stage');

let masterCanvas, masterCtx;
let localCanvas, localCtx;
let cursorCanvas, cursorCtx;

// create a new canvas and attach it to the stage
function createCanvas(z, editable = false) {
  const c = document.createElement('canvas');
  Object.assign(c.style, {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: z,
    pointerEvents: editable ? 'auto' : 'none'
  });
  stage.appendChild(c);
  return c;
}

// setup all layers
export function setupLayers() {
  masterCanvas = createCanvas(1, false);
  masterCtx = masterCanvas.getContext('2d');

  cursorCanvas = createCanvas(2, false);
  cursorCtx = cursorCanvas.getContext('2d');

  localCanvas = createCanvas(3, true);
  localCtx = localCanvas.getContext('2d');
  localCtx.lineCap = 'round';
  localCtx.lineJoin = 'round';

  resizeAllCanvases();
  window.addEventListener('resize', resizeAllCanvases);
}

// keep all canvases aligned with stage size
export function resizeAllCanvases() {
  const rect = stage.getBoundingClientRect();
  const { width, height } = rect;

  [masterCanvas, cursorCanvas, localCanvas].forEach(c => {
    c.width = width;
    c.height = height;
  });

  [masterCtx, cursorCtx, localCtx].forEach(ctx => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  });
}

// normalize pointer position into [0, 1] range
export function getNormalizedPos(e) {
  const rect = localCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height
  };
}

// convert normalized position back to canvas coordinates
export function toLocalCoords(norm) {
  const rect = localCanvas.getBoundingClientRect();
  return {
    x: norm.x * rect.width,
    y: norm.y * rect.height
  };
}

// draw a stroke from normalized coordinates
export function drawStroke(ctx, stroke) {
  const pts = stroke.points;
  if (!pts || pts.length < 2) return;

  const start = toLocalCoords(pts[0]);
  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.moveTo(start.x, start.y);

  for (let i = 1; i < pts.length; i++) {
    const p = toLocalCoords(pts[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.closePath();
}

// render all strokes to the master layer
export function renderMaster(strokes) {
  masterCtx.clearRect(0, 0, masterCanvas.width, masterCanvas.height);
  strokes.forEach(s => drawStroke(masterCtx, s));
}

// manage cursors
const cursors = {};
export function updateCursor(id, pos, color) {
  const p = toLocalCoords(pos);
  cursors[id] = { x: p.x, y: p.y, color };
  drawCursors();
}

export function removeCursor(id) {
  delete cursors[id];
  drawCursors();
}

export function drawCursors() {
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  for (const id in cursors) {
    const { x, y, color } = cursors[id];
    cursorCtx.beginPath();
    cursorCtx.arc(x, y, 5, 0, Math.PI * 2);
    cursorCtx.fillStyle = color;
    cursorCtx.fill();
    cursorCtx.lineWidth = 1.5;
    cursorCtx.strokeStyle = 'white';
    cursorCtx.stroke();
  }
}

export { localCanvas, localCtx, masterCtx };
