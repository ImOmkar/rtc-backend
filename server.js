const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",  // Allow all origins (for development)
  },
});

const usersInRoom = {}; // Track users in each room

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomName, userName }) => {
    socket.join(roomName);

    if (!usersInRoom[roomName]) {
      usersInRoom[roomName] = [];
    }

    // Notify new user about existing users in the room
    const existingUsers = usersInRoom[roomName];
    socket.emit("all-users", existingUsers);

    // Store new user in room
    usersInRoom[roomName].push({ id: socket.id, userName });

    // Notify all users that a new user joined
    socket.broadcast.to(roomName).emit("user-connected", { userId: socket.id, name: userName });

    console.log(`${userName} joined the room: ${roomName}`);

  });

  socket.on("sending-signal", ({ userToSignal, callerId, signal }) => {
    io.to(userToSignal).emit("receive-signal", { signal, callerId });
  });

  socket.on("returning-signal", ({ signal, callerId }) => {
    io.to(callerId).emit("receive-signal", { signal, callerId });
  });

  socket.on("leave-room", ({ roomName }) => {
    socket.leave(roomName);
    for (let roomName in usersInRoom) {
        if (usersInRoom[roomName]) {
          usersInRoom[roomName] = usersInRoom[roomName].filter((user) => user.id !== socket.id);
  
          // Notify the room that the user has disconnected.
          socket.to(roomName).emit('user-disconnected', socket.id);
        }
    }    
    io.to(roomName).emit("user-disconnected", socket.id);
  });

  socket.on("disconnect", () => {
    for (let room in usersInRoom) {
      usersInRoom[room] = usersInRoom[room].filter((user) => user.id !== socket.id);
      io.to(room).emit("user-disconnected", { userId: socket.id, name: userName });
    }
  });
  
});

  
server.listen(5000, () => console.log("Server running on port 5000"));
