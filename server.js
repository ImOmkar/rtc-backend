// const express = require("express");
// const http = require("http");
// const socketIo = require("socket.io");
// const cors = require("cors");

// const app = express();
// app.use(cors({ origin: "*" }));

// const server = http.createServer(app);
// const io = socketIo(server, {
//   path: "/ws",  // 👈 Explicit WebSocket route
//   cors: {
//     origin: "*",
//   },
// });

// const rooms = {}; // Store active rooms

// io.on("connection", (socket) => {
//   console.log("⚡ New user connected");

//   socket.on("create-room", (roomID) => {
//     rooms[roomID] = [socket.id];
//     socket.join(roomID);
//     console.log(`🏠 Room ${roomID} created`);
//   });

//   socket.on("join-room", (roomID) => {
//     if (rooms[roomID]) {
//       rooms[roomID].push(socket.id);
//       socket.join(roomID);
//       console.log(`👥 User joined room ${roomID}`);

//       // Send the list of existing users to the new user
//       const otherUsers = rooms[roomID].filter(id => id !== socket.id);
//       socket.emit('all users', otherUsers);

//     } else {
//       socket.emit("error", "Room does not exist!");
//     }
//   });

//   socket.on('sending signal', (payload) => {
//     io.to(payload.userToSignal).emit('user joined', { signal: payload.signal, callerID: socket.id }); // Use socket.id instead of payload.callerID
//   });

//   socket.on('returning signal', (payload) => {
//     io.to(payload.callerID).emit('receiving returned signal', { signal: payload.signal, id: socket.id });
//   });

//   socket.on("offer", ({ roomID, offer }) => {
//     socket.to(roomID).emit("offer", { offer });
//   });

//   socket.on("answer", ({ roomID, answer }) => {
//     socket.to(roomID).emit("answer", { answer });
//   });

//   socket.on("ice-candidate", ({ roomID, candidate }) => {
//     socket.to(roomID).emit("ice-candidate", { candidate });
//   });

//    socket.on('disconnect', () => {
//     console.log('A user disconnected');
//     for (const roomID in rooms) {
//       if (rooms[roomID].includes(socket.id)) {
//         rooms[roomID] = rooms[roomID].filter(id => id !== socket.id);
//         if (rooms[roomID].length === 0) {
//           delete rooms[roomID];
//         }
//          // Notify other users in the room
//          socket.to(roomID).emit('user left', socket.id);
//       }
//     }
//   });
// });


// // Use Railway-provided PORT
// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', (callback) => {
    const roomId = generateRoomId();
    rooms.set(roomId, new Set([socket.id]));
    socket.join(roomId);
    callback(roomId);
  });

  socket.on('join-room', (roomId, callback) => {
    const room = rooms.get(roomId);
    if (room) {
      room.add(socket.id);
      socket.join(roomId);
      // Notify other users in the room
      socket.to(roomId).emit('user-joined', socket.id);
      callback({ success: true, participants: Array.from(room) });
    } else {
      callback({ success: false, error: 'Room not found' });
    }
  });

  socket.on('offer', ({ offer, to }) => {
    socket.to(to).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ answer, to }) => {
    socket.to(to).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, to }) => {
    socket.to(to).emit('ice-candidate', { candidate, from: socket.id });
  });

  socket.on('disconnect', () => {
    // Remove user from all rooms they were in
    rooms.forEach((participants, roomId) => {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);
        if (participants.size === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('user-left', socket.id);
        }
      }
    });
  });
});

function generateRoomId() {
  return Math.random().toString(36).substr(2, 6);
}

// Use Railway-provided PORT
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));