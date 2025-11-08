const path = require('path');
let express = require('express')
let app = express()
let httpServer = require('http').createServer(app)
let io = require('socket.io')(httpServer)

let PORT = process.env.PORT || 5050 //for heroku deployment

let connections = [];
let history = []; 
let index = -1;

io.on('connect', (socket) =>{
  connections.push(socket);
  console.log(`${socket.id} has connected`);

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

  const userColor = `hsl(${Math.random() * 360}, 80%, 60%)`;
  socket.on('cursor', (pos) => {
    socket.broadcast.emit('cursor', {
      id: socket.id,
      x: pos.x,
      y: pos.y,
      color: userColor,
    });
  });
  
  
  socket.on('disconnect', (reason)=>{
    console.log(`${socket.id} has disconnected`)
    connections = connections.filter((connection) => connection.id !==socket.id);
    socket.broadcast.emit('removeCursor', socket.id);
  });
})



const clientPath = path.join(__dirname, '..' , 'client');
app.use(express.static(clientPath));

httpServer.listen(PORT, ()=>{
  console.log(`Server Started on port ${PORT}`);
  
})