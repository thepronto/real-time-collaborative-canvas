const path = require('path');
const express = require('express');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 5050;

// --- Data Storage ---
let users = {};                // { socket.id: color }
let strokeHistory = [];        // array of stroke objects {userId, color, width, points:[]}
let redoStack = [];            // for global redo

// Optional persistence path (for future)
const STROKE_PATH = path.join(__dirname, 'strokes.json');

// If you want to restore previous drawing:
if (fs.existsSync(STROKE_PATH)) {
  try {
    const saved = JSON.parse(fs.readFileSync(STROKE_PATH, 'utf8'));
    strokeHistory = saved;
    console.log(`🟢 Restored ${strokeHistory.length} saved strokes.`);
  } catch (err) {
    console.error('Failed to load saved strokes:', err);
  }
} else {
  console.log('🟡 No saved stroke history found. Starting fresh.');
}

// ================= SOCKET HANDLING ==================
io.on('connection', (socket) => {
  // Assign a random color for this user
  const color = `hsl(${Math.random() * 360}, 80%, 60%)`;
  users[socket.id] = color;
  console.log(`🟢 ${socket.id} connected (${color})`);

  // Notify everyone about the new user list
  io.emit('users', users);

  // Send initial state (all strokes) to this user
  socket.emit('init', { users, strokes: strokeHistory });

  // --- Cursor Tracking ---
  socket.on('cursor', (pos) => {
    socket.broadcast.emit('cursor', {
      id: socket.id,
      x: pos.x,
      y: pos.y,
      color: users[socket.id],
    });
  });

  // --- Live partial stroke updates (for smooth real-time) ---
  socket.on('stroke:partial', (data) => {
    socket.broadcast.emit('stroke:partial', {
      userId: socket.id,
      stroke: data
    });
  });

  // --- Finalized stroke (end of drawing) ---
  socket.on('stroke:end', (data) => {
    const stroke = {
      userId: socket.id,
      color: data.color,
      width: data.width,
      points: data.points
    };

    strokeHistory.push(stroke);
    redoStack = []; // clear redo on new stroke

    // Broadcast full updated stroke history to all clients
    io.emit('master:updateAll', strokeHistory);
  });

  // --- Global UNDO ---
  socket.on('undo', () => {
    if (strokeHistory.length > 0) {
      const undone = strokeHistory.pop();
      redoStack.push(undone);
      io.emit('master:updateAll', strokeHistory);
    }
  });

  // --- Global REDO ---
  socket.on('redo', () => {
    if (redoStack.length > 0) {
      const redone = redoStack.pop();
      strokeHistory.push(redone);
      io.emit('master:updateAll', strokeHistory);
    }
  });

  // --- Global CLEAR ---
  socket.on('clear', () => {
    strokeHistory = [];
    redoStack = [];
    io.emit('master:updateAll', strokeHistory);
  });

  // --- Ping test (keep alive check) ---
  socket.on('pingCheck', () => socket.emit('pongCheck'));

  // --- On disconnect ---
  socket.on('disconnect', () => {
    console.log(`🔴 ${socket.id} disconnected`);
    delete users[socket.id];
    io.emit('users', users);
    io.emit('removeCursor', socket.id);

    // Optional: Save to disk when last user leaves
    if (Object.keys(users).length === 0 && strokeHistory.length > 0) {
      try {
        fs.writeFileSync(STROKE_PATH, JSON.stringify(strokeHistory, null, 2), 'utf8');
        console.log('💾 Saved strokes to file (on last disconnect).');
      } catch (err) {
        console.error('❌ Failed to save strokes:', err);
      }
    }
  });
});

// ================= EXPRESS SETUP ==================
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
