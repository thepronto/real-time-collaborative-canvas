// websocket.js — handles all socket communication and updates

import {
  renderMaster, updateCursor, removeCursor,
  getNormalizedPos, toLocalCoords,
  localCanvas, localCtx
} from './canvas.js';

export const socket = io();

let drawing = false;
let color = 'black';
let lineWidth = 6;
let currentStroke = null;
export let latestStrokes = [];

// expose a setup method to initialize socket events
export function setupSocket(onUsersUpdate) {

  socket.on('init', ({ users, strokes }) => {
    latestStrokes = strokes || [];
    renderMaster(latestStrokes);
    onUsersUpdate(users);
  });

  socket.on('users', onUsersUpdate);

  socket.on('stroke:partial', ({ userId, stroke }) => {
    if (userId === socket.id) return;
    const ctx = localCtx.canvas.previousElementSibling.getContext('2d');
    const { color, width, points, type } = stroke;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    if (type === 'begin') {
      const start = toLocalCoords(points[0]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
    } else if (type === 'draw') {
      const p = toLocalCoords(points[0]);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  });

  socket.on('master:updateAll', (strokes) => {
    latestStrokes = strokes || [];
    renderMaster(latestStrokes);
    localCtx.clearRect(0, 0, localCanvas.width, localCanvas.height);
  });

  socket.on('cursor', (data) => updateCursor(data.id, data, data.color));
  socket.on('removeCursor', removeCursor);
  socket.on('userDisconnected', removeCursor);
}

// handle local drawing and emit stroke events
export function enableDrawing(getColor, getWidth) {
  localCanvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    drawing = true;

    color = getColor();
    lineWidth = getWidth();

    const norm = getNormalizedPos(e);
    currentStroke = { color, width: lineWidth, points: [norm] };

    const p = toLocalCoords(norm);
    localCtx.beginPath();
    localCtx.moveTo(p.x, p.y);

    socket.emit('stroke:partial', { type: 'begin', color, width: lineWidth, points: [norm] });
  });

  localCanvas.addEventListener('pointermove', (e) => {
    e.preventDefault();
    const norm = getNormalizedPos(e);
    socket.emit('cursor', norm);

    if (!drawing) return;

    currentStroke.points.push(norm);

    const p = toLocalCoords(norm);
    localCtx.strokeStyle = color;
    localCtx.lineWidth = lineWidth;
    localCtx.lineTo(p.x, p.y);
    localCtx.stroke();

    socket.emit('stroke:partial', { type: 'draw', color, width: lineWidth, points: [norm] });
  });

  window.addEventListener('pointerup', () => {
    if (!drawing) return;
    drawing = false;
    localCtx.closePath();
    socket.emit('stroke:end', currentStroke);
    currentStroke = null;
  });
}
