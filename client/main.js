// main.js — ties UI, canvas, and websocket logic together

import { setupLayers } from './canvas.js';
import { setupSocket, enableDrawing, socket } from './websocket.js';

// initialize canvases
setupLayers();

// UI references
const colorButtons = document.querySelectorAll('.color-btn');
const brushBtn = document.getElementById('tool-brush');
const eraserBtn = document.getElementById('tool-eraser');
const sizeRange = document.getElementById('sizeRange');
const usersList = document.getElementById('usersList');

let tool = 'brush';
let color = 'black';
let lastPenColor = 'black';
let lineWidth = 6;

// handle colors
colorButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    colorButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    if (tool === 'eraser') switchToBrush();
    color = btn.dataset.color;
    lastPenColor = color;
  });
});

document.getElementById('colorPicker').addEventListener('input', (e) => {
  colorButtons.forEach(b => b.classList.remove('selected'));
  if (tool === 'eraser') switchToBrush();
  color = e.target.value;
  lastPenColor = color;
});

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

sizeRange.addEventListener('input', (e) => lineWidth = Number(e.target.value));

document.getElementById('clearBtn').onclick = () => socket.emit('clear');
document.getElementById('undoBtn').onclick = () => socket.emit('undo');
document.getElementById('redoBtn').onclick = () => socket.emit('redo');

// user list UI
function updateUserList(users) {
  usersList.innerHTML = Object.entries(users)
    .map(([id, color]) => `
      <li><span class="user-dot" style="background:${color}"></span>User ${id.slice(0,5)}</li>
    `)
    .join('');
}

// wire up websocket and drawing
setupSocket(updateUserList);
enableDrawing(() => color, () => lineWidth);
