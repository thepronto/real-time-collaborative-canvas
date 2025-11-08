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
  rect = canvas.getBoundingClientRect();
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

}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function saveSnapshotAndEmit() {
  const image = canvas.toDataURL('image/png');  //Base64 encoded snapshot
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = data.image;
});
