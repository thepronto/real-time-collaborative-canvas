/* canvas.js - fixed & integrated for strokeHistory server */

/* ====== SOCKET & STAGE ====== */
const socket = io();
const stage = document.getElementById('stage');
const cursors = {};

/* ====== CANVAS LAYERS ====== */
let masterCanvas, masterCtx;
let localCanvas, localCtx;
let cursorCanvas, cursorCtx;

/* create canvas element inside #stage */
function createCanvas(z, editable = false) {
  const c = document.createElement('canvas');
  const rect = stage.getBoundingClientRect();
  c.width = rect.width;
  c.height = rect.height;
  c.style.position = 'absolute';
  c.style.top = '0';
  c.style.left = '0';
  c.style.zIndex = z;
  c.style.pointerEvents = editable ? 'auto' : 'none';
  c.style.width = '100%';
  c.style.height = '100%';
  stage.appendChild(c);
  return c;
}

/* init layers */
function setupLayers() {
  masterCanvas = createCanvas(1, false);
  masterCtx = masterCanvas.getContext('2d');

  cursorCanvas = createCanvas(2, false);
  cursorCtx = cursorCanvas.getContext('2d');

  localCanvas = createCanvas(3, true);
  localCtx = localCanvas.getContext('2d');
  localCtx.lineCap = 'round';
  localCtx.lineJoin = 'round';
}

/* run setup */
setupLayers();

/* ====== GLOBAL STATE ====== */
let drawing = false;
let tool = 'brush';
let color = 'black';
let lastPenColor = 'black';
let lineWidth = 6;
let currentStroke = null;
let latestStrokes = []; // holds latest master strokes from server

/* ====== DPI + RESIZE ====== */
function applyDPR(ctx) {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* resize all canvases, keep DPR and re-render master */
function resizeAllCanvases() {
  const rect = stage.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  [masterCanvas, localCanvas, cursorCanvas].forEach((c) => {
    c.width = width;
    c.height = height;
    c.style.width = width + 'px';
    c.style.height = height + 'px';
  });

  // No DPR transforms — everything 1:1 with CSS
  masterCtx.setTransform(1, 0, 0, 1, 0, 0);
  localCtx.setTransform(1, 0, 0, 1, 0, 0);
  cursorCtx.setTransform(1, 0, 0, 1, 0, 0);

  renderMaster(latestStrokes);
  drawCursors();
}

/* call once initially to size canvases correctly */
resizeAllCanvases();
window.addEventListener('resize', resizeAllCanvases);

/* ====== Normalized Coordinate Helpers (use localCanvas as reference) ====== */
function getNormalizedPos(e) {
  const rect = localCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height,
  };
}

function toLocalCoords(norm) {
  const rect = localCanvas.getBoundingClientRect();
  return {
    x: norm.x * rect.width,
    y: norm.y * rect.height,
  };
}

/* ====== Drawing helper — assumes stroke.points are normalized (0..1) ====== */
function drawStroke(ctx, stroke) {
  const pts = stroke.points;
  if (!pts || pts.length < 2) return;
  const p0 = toLocalCoords(pts[0]);
  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < pts.length; i++) {
    const p = toLocalCoords(pts[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.closePath();
}

/* ====== Touch prevention on stage (prevents scrolling when drawing on mobile) ====== */
stage.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

/* ====== LOCAL POINTER EVENTS (normalized coords) ====== */
localCanvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  drawing = true;
  const norm = getNormalizedPos(e);

  currentStroke = {
    color,
    width: lineWidth,
    points: [norm]
  };

  const p = toLocalCoords(norm);
  localCtx.beginPath();
  localCtx.moveTo(p.x, p.y);

  socket.emit('stroke:partial', {
    type: 'begin',
    color,
    width: lineWidth,
    points: [norm]
  });
});

localCanvas.addEventListener('pointermove', (e) => {
  e.preventDefault();

  // always emit cursor normalized
  const norm = getNormalizedPos(e);
  socket.emit('cursor', norm);

  if (!drawing) return;

  // append normalized point
  currentStroke.points.push(norm);

  // draw locally (pixel coords)
  const p = toLocalCoords(norm);
  localCtx.lineWidth = lineWidth;
  localCtx.strokeStyle = color;
  localCtx.lineTo(p.x, p.y);
  localCtx.stroke();

  // send partial update (only this recent normalized point)
  socket.emit('stroke:partial', {
    type: 'draw',
    color,
    width: lineWidth,
    points: [norm]
  });
});

window.addEventListener('pointerup', () => {
  if (!drawing) return;
  drawing = false;
  localCtx.closePath();

  // final stroke (normalized points)
  socket.emit('stroke:end', currentStroke);
  currentStroke = null;
});

/* ====== SOCKET HANDLERS ====== */

/* init: server sends current users + full strokes list */
socket.on('init', ({ users, strokes }) => {
  latestStrokes = strokes || [];
  renderMaster(latestStrokes);
  updateUserList(users);
});

/* users list update */
socket.on('users', (users) => updateUserList(users));

/* real-time partials from other users */
socket.on('stroke:partial', ({ userId, stroke }) => {
  // ignore our own partials
  if (userId === socket.id) return;

  const { color: c, width: w, points, type } = stroke;
  masterCtx.strokeStyle = c;
  masterCtx.lineWidth = w;

  if (type === 'begin') {
    const start = toLocalCoords(points[0]);
    masterCtx.beginPath();
    masterCtx.moveTo(start.x, start.y);
  } else if (type === 'draw') {
    const p = toLocalCoords(points[0]);
    masterCtx.lineTo(p.x, p.y);
    masterCtx.stroke();
  }
});

/* server sends the full updated stroke array — redraw master and clear live layers */
socket.on('master:updateAll', (strokes) => {
  latestStrokes = strokes || [];
  renderMaster(latestStrokes);

  // clear local live drawing so it doesn't duplicate
  localCtx.clearRect(0, 0, localCanvas.width, localCanvas.height);

  // clear any temporary per-user layers if you implement them later
});

/* cursor events */
socket.on('cursor', (data) => {
  const p = toLocalCoords(data);
  cursors[data.id] = { x: p.x, y: p.y, color: data.color };
  drawCursors();
});

socket.on('removeCursor', (id) => {
  delete cursors[id];
  drawCursors();
});

/* when a user disconnects update users list */
socket.on('userDisconnected', (id) => {
  delete cursors[id];
  drawCursors();
});

/* ====== RENDER HELPERS ====== */
function renderMaster(strokes) {
  masterCtx.clearRect(0, 0, masterCanvas.width, masterCanvas.height);
  (strokes || []).forEach((s) => drawStroke(masterCtx, s));
}

function drawCursors() {
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  for (const id in cursors) {
    const { x, y, color: c } = cursors[id];
    cursorCtx.beginPath();
    cursorCtx.arc(x, y, 5, 0, Math.PI * 2);
    cursorCtx.fillStyle = c;
    cursorCtx.fill();
    cursorCtx.lineWidth = 1.5;
    cursorCtx.strokeStyle = 'white';
    cursorCtx.stroke();
  }
}

/* ====== CONTROLS & TOOLS (kept behavior) ====== */
const colorButtons = document.querySelectorAll('.color-btn');
colorButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    colorButtons.forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    if (tool === 'eraser') switchToBrush();
    color = btn.dataset.color;
    lastPenColor = color;
  });
});

document.getElementById('colorPicker').addEventListener('input', (e) => {
  colorButtons.forEach((b) => b.classList.remove('selected'));
  if (tool === 'eraser') switchToBrush();
  color = e.target.value;
  lastPenColor = color;
});

const brushBtn = document.getElementById('tool-brush');
const eraserBtn = document.getElementById('tool-eraser');

function switchToBrush() {
  tool = 'brush';
  brushBtn.classList.add('active');
  eraserBtn.classList.remove('active');
  color = lastPenColor;
}

function switchToEraser() {
  tool = 'eraser';
  eraserBtn.classList.add('active');
  brushBtn.classList.remove('active');
  color = 'white';
}

brushBtn.onclick = switchToBrush;
eraserBtn.onclick = switchToEraser;

document.getElementById('sizeRange').addEventListener('input', (e) => {
  lineWidth = Number(e.target.value);
});

document.getElementById('clearBtn').onclick = () => socket.emit('clear');
document.getElementById('undoBtn').onclick = () => socket.emit('undo');
document.getElementById('redoBtn').onclick = () => socket.emit('redo');

/* ====== USER LIST ====== */
const usersList = document.getElementById('usersList');
function updateUserList(users) {
  usersList.innerHTML = Object.entries(users)
    .map(([id, color]) => `
      <li>
        <span class="user-dot" style="background:${color}"></span>
        User ${id.slice(0, 5)}
      </li>
    `)
    .join('');
}

/* ====== STATS (FPS / PING) ====== */
const fpsE = document.getElementById('fpsStat');
const pingE = document.getElementById('pingStat');

let lastFrame = performance.now();
let frames = 0;
let fps = 0;

function trackFPS() {
  frames++;
  const now = performance.now();
  if (now - lastFrame >= 1000) {
    fpsE.textContent = `FPS: ${frames}`;
    frames = 0;
    lastFrame = now;
  }
  requestAnimationFrame(trackFPS);
}
trackFPS();

let lastPing = 0;
setInterval(() => {
  lastPing = Date.now();
  socket.emit('pingCheck');
}, 2000);

socket.on('pongCheck', () => {
  const latency = Date.now() - lastPing;
  pingE.textContent = `Ping: ${latency} ms`;
});
