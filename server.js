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
//     } else {
//       socket.emit("error", "Room does not exist!");
//     }

//     const otherUsers = rooms.get(roomID).filter(id => id !== socket.id);
//     socket.emit('all users', otherUsers);

//     if (roomMessages[roomID]) {
//       socket.emit('chatHistory', roomMessages[roomID]);
//     }
//   });

//   socket.on('sending signal', (payload) => {
//     io.to(payload.userToSignal).emit('user joined', { signal: payload.signal, callerID: payload.callerID });
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
//     rooms.forEach((value, key) => {
//       if (value.includes(socket.id)) {
//         rooms.set(key, value.filter(id => id !== socket.id));
//         if (rooms.get(key).length === 0) {
//           rooms.delete(key);
//         }
//       }
//     });
//     socket.broadcast.emit('user left', socket.id);
//   });
// });


// // Use Railway-provided PORT
// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

const server = http.createServer(app);
const io = socketIo(server, {
  path: "/ws",  // 👈 Explicit WebSocket route
  cors: {
    origin: "*",
  },
});

const rooms = {}; // Store active rooms

io.on("connection", (socket) => {
  console.log("⚡ New user connected");

  socket.on("create-room", (roomID) => {
    rooms[roomID] = [socket.id];
    socket.join(roomID);
    console.log(`🏠 Room ${roomID} created`);
  });

  socket.on("join-room", (roomID) => {
    if (rooms[roomID]) {
      rooms[roomID].push(socket.id);
      socket.join(roomID);
      console.log(`👥 User joined room ${roomID}`);

      // Send the list of existing users to the new user
      const otherUsers = rooms[roomID].filter(id => id !== socket.id);
      socket.emit('all users', otherUsers);

    } else {
      socket.emit("error", "Room does not exist!");
    }
  });

  socket.on('sending signal', (payload) => {
    io.to(payload.userToSignal).emit('user joined', { signal: payload.signal, callerID: socket.id }); // Use socket.id instead of payload.callerID
  });

  socket.on('returning signal', (payload) => {
    io.to(payload.callerID).emit('receiving returned signal', { signal: payload.signal, id: socket.id });
  });

  socket.on("offer", ({ roomID, offer }) => {
    socket.to(roomID).emit("offer", { offer });
  });

  socket.on("answer", ({ roomID, answer }) => {
    socket.to(roomID).emit("answer", { answer });
  });

  socket.on("ice-candidate", ({ roomID, candidate }) => {
    socket.to(roomID).emit("ice-candidate", { candidate });
  });

   socket.on('disconnect', () => {
    console.log('A user disconnected');
    for (const roomID in rooms) {
      if (rooms[roomID].includes(socket.id)) {
        rooms[roomID] = rooms[roomID].filter(id => id !== socket.id);
        if (rooms[roomID].length === 0) {
          delete rooms[roomID];
        }
         // Notify other users in the room
         socket.to(roomID).emit('user left', socket.id);
      }
    }
  });
});


// Use Railway-provided PORT
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
