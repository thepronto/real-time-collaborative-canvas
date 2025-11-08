const path = require('path');
let express = require('express')
let app = express()
let httpServer = require('http').createServer(app)
let io = require('socket.io')(httpServer)

let PORT = process.env.PORT || 5050 //for heroku deployment

let connections = [];

io.on('connect', (socket) =>{
  connections.push(socket);
  console.log(`${socket.id} has connected`);

  socket.on('draw', (data) => {
    socket.broadcast.emit('draw', data);
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



const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

httpServer.listen(PORT, ()=>{
  console.log(`Server Started on port ${PORT}`);
  
})