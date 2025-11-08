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

// Snapshots
let history = [];
let index = -1;

const socket = io();

// Resize Canvas
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  const pixelWidth = Math.round(rect.width * dpr);
  const pixelHeight = Math.round(rect.height * dpr);

  [canvas, cursorCanvas].forEach((c, i) => {
    c.style.width = rect.width + 'px';
    c.style.height = rect.height + 'px';
    c.width = pixelWidth;
    c.height = pixelHeight;

    const context = i === 0 ? ctx : cursorCtx;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  });

  restoreSnapshot();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function saveSnapshot() {
  // Trim redo states if we draw after undo
  history = history.slice(0, index + 1);
  const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  history.push(snapshot);
  index = history.length - 1;
}

// Restore a specific snapshot
function restoreSnapshot() {
  if (index >= 0 && history[index]) {
    ctx.putImageData(history[index], 0, 0);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}


// Get pointer position
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// Drawing Events
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
    width: lineWidth,
    tool
  });

});

canvas.addEventListener('pointermove', (e) => {
  const p = getPos(e);
  socket.emit('cursor', p);
  if (!drawing) return;

  drawLine(p.x, p.y, currentColor, lineWidth, tool);
  socket.emit('draw', {
    type: 'draw',
    x: p.x,
    y: p.y,
    color: currentColor,
    width: lineWidth,
    tool
  });
});


function drawLine(x,y,color,width,toolType){
  ctx.lineWidth = width;
  ctx.lineCap = "round"; // for smoothly joining points, instead of ragged/choppy lines and dots
  ctx.lineJoin = "round";

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'white';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
  }

  ctx.lineTo(x,y);
  ctx.stroke();
}

window.addEventListener('pointerup', () => {
  if (!drawing) return;
  drawing = false;
  ctx.closePath();
  saveSnapshot();
  socket.emit('draw', { type: 'end' });
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

// Tool Switching
function switchToBrush() {
  tool = 'brush';
  document.getElementById('tool-brush').classList.add('active');
  document.getElementById('tool-eraser').classList.remove('active');
  currentColor = lastPenColor;
}

function switchToEraser() {
  tool = 'eraser';
  document.getElementById('tool-eraser').classList.add('active');
  document.getElementById('tool-brush').classList.remove('active');
  currentColor = 'white';
}

document.getElementById('tool-brush').onclick = switchToBrush;
document.getElementById('tool-eraser').onclick = switchToEraser;

// Size Slider
document.getElementById('sizeRange').addEventListener('input', (e) => {
  lineWidth = Number(e.target.value);
});


document.getElementById('clearBtn').onclick = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  history = [];
  index = -1;
  socket.emit('clear');
};


document.getElementById('undoBtn').onclick = () => {
  if (index >= 0) {
    index--;
    restoreSnapshot();
  }
};

// Redo
document.getElementById('redoBtn').onclick = () => {
  if (index < history.length - 1) {
    index++;
    restoreSnapshot();
  }
};



socket.on('draw', (data) => {
  if (data.type === 'begin') {
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
  } else if (data.type === 'draw') {
    drawLine(data.x, data.y, data.color, data.width, data.tool);
  } else if (data.type === 'end') {
    ctx.closePath();
  }
});

socket.on('clear', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  history = [];
  index = -1;
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
