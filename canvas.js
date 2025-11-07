const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');

let drawing = false;
let tool = 'brush';
let currentColor = 'black';
let lastPenColor = 'black';
let lineWidth = 6;






// Resize Canvas
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

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
});

canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = getPos(e);
  ctx.lineWidth = lineWidth;

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'white';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = currentColor;
  }

  ctx.lineTo(p.x, p.y);
  ctx.stroke();
});

window.addEventListener('pointerup', () => {
  drawing = false;
  ctx.closePath();
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
};
