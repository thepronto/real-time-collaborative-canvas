const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');

const cursorCanvas = document.createElement('canvas');//for cursors
const cursorCtx = cursorCanvas.getContext('2d');

canvas.parentElement.appendChild(cursorCanvas);
const cursors = {};


let drawing = false;
let tool = 'brush';
let currentColor = 'black';
let lastPenColor = 'black';
let lineWidth = 6;
let rect;


const socket = io();

// Resize Canvas
function resizeCanvas() {
  // Save current visible drawing before resizing
  const tempImage = canvas.toDataURL('image/png');

  // Compute new DPR-aware dimensions
  rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(rect.width * dpr);
  const pixelHeight = Math.round(rect.height * dpr);

  // Resize both canvases
  [canvas, cursorCanvas].forEach((c, i) => {
    c.style.width = rect.width + 'px';
    c.style.height = rect.height + 'px';
    c.width = pixelWidth;
    c.height = pixelHeight;

    const context = i === 0 ? ctx : cursorCtx;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  });

  // Redraw saved content (only if there was something)
  const img = new Image();
  img.onload = () => {
    // Reset transform temporarily to avoid double scaling
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Reapply DPR transform for future drawing
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  img.src = tempImage;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function saveSnapshotAndEmit() {
  // Temporarily reset transform so toDataURL() captures the actual canvas content
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const image = canvas.toDataURL('image/png');

  // Reapply the correct DPR scaling (so future drawing works as before)
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  socket.emit('snapshot', { image });
}


// Get pointer position
function getPos(e) {
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

canvas.addEventListener('pointerdown', (e) => {
  drawing = true;
  const p = getPos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);

  socket.emit('draw', {
    type: 'begin',
    x: p.x,
    y: p.y,
    color: currentColor,
    width: lineWidth
  });

});

canvas.addEventListener('pointermove', (e) => {
  const p = getPos(e);
  socket.emit('cursor', p);
  if (!drawing) return;

  drawLine(p.x, p.y, currentColor, lineWidth);
  socket.emit('draw', {
    type: 'draw',
    x: p.x,
    y: p.y,
    color: currentColor,
    width: lineWidth
  });
});

function drawLine(x,y,color,width){
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineCap = "round"; // for smoothly joining points, instead of ragged/choppy lines and dots
  ctx.lineJoin = "round";

  ctx.lineTo(x,y);
  ctx.stroke();
}

window.addEventListener('pointerup', () => {
  if (!drawing) return;
  drawing = false;
  ctx.closePath();
  socket.emit('draw', { type: 'end' });
  saveSnapshotAndEmit(); // send to server
});

// Color Buttons
const colorButtons = document.querySelectorAll('.color-btn');
colorButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    colorButtons.forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    if (tool === 'eraser') switchToBrush();
    currentColor = btn.dataset.color;
    lastPenColor = currentColor;
  });
});

// Color Picker
const colorPicker = document.getElementById('colorPicker');
colorPicker.addEventListener('input', (e) => {
  colorButtons.forEach((b) => b.classList.remove('selected'));
  if (tool === 'eraser') switchToBrush();
  currentColor = e.target.value;
  lastPenColor = currentColor;
});

const brushBtn = document.getElementById('tool-brush');
const eraserBtn = document.getElementById('tool-eraser');

function switchToBrush() {
  tool = 'brush';
  brushBtn.classList.add('active');
  eraserBtn.classList.remove('active');
  currentColor = lastPenColor;
}

function switchToEraser() {
  tool = 'eraser';
  eraserBtn.classList.add('active');
  brushBtn.classList.remove('active');
  currentColor = 'white';
}

brushBtn.onclick = switchToBrush;
eraserBtn.onclick = switchToEraser;

// Size Slider
document.getElementById('sizeRange').addEventListener('input', (e) => {
  lineWidth = Number(e.target.value);
});


document.getElementById('clearBtn').onclick = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit('clear');
  saveSnapshotAndEmit();
};

document.getElementById('undoBtn').onclick = () => {
  socket.emit('undo');
};

document.getElementById('redoBtn').onclick = () => {
  socket.emit('redo');
};

socket.on('draw', (data) => {
  if (data.type === 'begin') {
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
  } else if (data.type === 'draw') {
    drawLine(data.x, data.y, data.color, data.width);
  } else if (data.type === 'end') {
    ctx.closePath();
  }
});

socket.on('clear', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('cursor', (data) => {
  cursors[data.id] = { x: data.x, y: data.y, color: data.color };
  drawCursors();
});
socket.on('removeCursor', (id) => {
  delete cursors[id];
  drawCursors();
});
function drawCursors() {
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
socket.on('snapshot', (data) => {
  const img = new Image();
  img.onload = () => {
    // Reset transform temporarily to draw 1:1
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Reapply the DPR scaling for future strokes
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  img.src = data.image;
});

const usersList = document.getElementById('usersList');

socket.on('users', (users) => {
  usersList.innerHTML = Object.entries(users)
    .map(([id, color]) => `
      <li>
        <span class="user-dot" style="background:${color}"></span>
        User ${id.slice(0, 5)}
      </li>
    `)
    .join('');
});

const fpsE = document.getElementById('fpsStat');
const pingE = document.getElementById('pingStat');

let lastFrame = performance.now();
let frames = 0;
let fps = 0;

function trackFPS() {
  fps++;
  const now = performance.now();

  if (now - lastFrame >= 1000) {
    fpsE.textContent = `FPS: ${fps}`;
    fps = 0;
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