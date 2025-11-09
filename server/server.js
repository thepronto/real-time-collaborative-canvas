const path = require('path');
const fs = require('fs');
let express = require('express')
let app = express()
let httpServer = require('http').createServer(app)
let io = require('socket.io')(httpServer)

let PORT = process.env.PORT || 5050 //for heroku deployment

let users = {};
let history = []; 
let index = -1;
const SNAPSHOT_PATH = path.join(__dirname, 'latest_snapshot.txt');

if (fs.existsSync(SNAPSHOT_PATH)) {
  try {
    const saved = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
    history = [saved];
    index = 0;
    console.log('Restored saved drawing snapshot.');
  } catch (err) {
    console.error('Failed to load snapshot:', err);
  }
} else {
  console.log(' No previous snapshot found, starting fresh.');
}

io.on('connect', (socket) =>{
  const color = `hsl(${Math.random() * 360}, 80%, 60%)`;
  users[socket.id] = color;
  console.log(`${socket.id} connected (${color})`);

  io.emit('users', users);

  if (index >= 0) {
    socket.emit('snapshot', { image: history[index] });
  }

  socket.on('draw', (data) => {
    socket.broadcast.emit('draw', data);
  });

  socket.on('snapshot', (data) => {
    history = history.slice(0, index + 1);
    history.push(data.image);
    index = history.length - 1;
    io.emit('snapshot', { image: data.image });
  });

  // global undo
  socket.on('undo', () => {
    if (index > 0) {
      index--;
      io.emit('snapshot', { image: history[index] });
    }
  });

  // global redo
  socket.on('redo', () => {
    if (index < history.length - 1) {
      index++;
      io.emit('snapshot', { image: history[index] });
    }
  });

  socket.on('clear', () => {
    socket.broadcast.emit('clear');
  });

  socket.on('cursor', (pos) => {
    socket.broadcast.emit('cursor', {
      id: socket.id,
      x: pos.x,
      y: pos.y,
      color: users[socket.id],
    });
  });
  
  socket.on('disconnect', (reason)=>{
    console.log(`${socket.id} disconnected`);
    delete users[socket.id];
    io.emit('users', users);
    io.emit('removeCursor', socket.id);

    if (Object.keys(users).length === 0 && index >= 0) {
      try {
        fs.writeFileSync(SNAPSHOT_PATH, history[index], 'utf8');
        console.log(' Saved drawing snapshot (on last user disconnect).');
      } catch (err) {
        console.error(' Failed to save snapshot:', err);
      }
    }
  });


  socket.on('pingCheck', () => socket.emit('pongCheck'));


})

const clientPath = path.join(__dirname, '..' , 'client');
app.use(express.static(clientPath));

httpServer.listen(PORT, ()=>{
  console.log(`Server Started on port ${PORT}`);
  
})