const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const axios = require('axios')
const app = express();
const multer = require('multer');

app.use(cors({ origin: "*" }));

const server = http.createServer(app);
const io = socketIo(server, {
  path: "/ws",  // 👈 Explicit WebSocket route
  cors: {
    origin: "*",
  },
});

const storage = multer.memoryStorage();  // Store the file in memory (you can configure this to save to disk)
const upload = multer({ storage: storage });

const rooms = new Map();
const drawingrooms = {};
const roomMessages = {};
const stickyNotesPerRoom = {};
let stickyNotes = [];
let pptData = {};

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

//   socket.on('disconnect', () => {
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


io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('screenshot', (data) => {
    // Save the image or do something with it
    console.log('Received screenshot for room', data.roomId);
    console.log('Image data:', data.image);
  });

  socket.on('join room', (roomID) => {
    if (rooms.has(roomID)) {
      rooms.get(roomID).push(socket.id);
    } else {
      rooms.set(roomID, [socket.id]);
    }

    const otherUsers = rooms.get(roomID).filter(id => id !== socket.id);
    socket.emit('all users', otherUsers);

    if (roomMessages[roomID]) {
      socket.emit('chatHistory', roomMessages[roomID]);
    }
  });

  socket.on('sending signal', (payload) => {
    io.to(payload.userToSignal).emit('user joined', { signal: payload.signal, callerID: payload.callerID });
  });

  socket.on('returning signal', (payload) => {
    io.to(payload.callerID).emit('receiving returned signal', { signal: payload.signal, id: socket.id });
  });

  socket.on('sendMessage', ({ roomId, message }) => {
    if (!roomMessages[roomId]) {
      roomMessages[roomId] = [];
    }

    const chatMessage = { message, id: socket.id };
    roomMessages[roomId].push(chatMessage);
    io.in(roomId).emit('receiveMessage', chatMessage);
  });

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
    io.to(roomId).emit('syncStickyNotes', stickyNotes);

    if (drawingrooms[roomId]) {
      socket.emit("loadDrawing", drawingrooms[roomId]);
    } else {
      drawingrooms[roomId] = [];
    }

    if (stickyNotesPerRoom[roomId]) {
      socket.emit('syncStickyNotes', stickyNotesPerRoom[roomId]);
    } else {
      stickyNotesPerRoom[roomId] = []; // Initialize if not present
    }

    if (pptData[roomId]) {
      socket.emit('pptUploaded', pptData[roomId]);
    }
  });

  socket.on('uploadPpt', (pptData) => {
    const { roomId, pptFileData } = pptData;

    // Broadcast the ppt data to all clients in the room
    io.to(roomId).emit('pptUploaded', pptFileData);
  });

  socket.on('slideChanged', ({ roomId, currentIndex }) => {
    // Broadcast to other clients in the same room
    socket.to(roomId).emit('slideUpdated', currentIndex);
  });

  socket.on('offer', (offer) => {
    socket.broadcast.emit('offer', offer);
  });

  socket.on('answer', (answer) => {
    socket.broadcast.emit('answer', answer);
  });

  socket.on('ice-candidate', (candidate) => {
    socket.broadcast.emit('ice-candidate', candidate);
  });

  socket.on('drawing', (data) => {
    const { roomId, ...drawingData } = data;
    if (!drawingrooms[roomId]) {
      drawingrooms[roomId] = [];
    }
    drawingrooms[roomId].push(drawingData);

    // Broadcast drawing to others in the room
    socket.to(roomId).emit("drawing", drawingData);
  });

  socket.on("clearBoard", (roomId) => {
    if (drawingrooms[roomId]) {
      drawingrooms[roomId] = []; // Clear the drawings for the room
    }
    io.to(roomId).emit("clearBoard"); // Notify all users in the room
  });

  socket.on('createStickyNote', (noteData) => {
    const { roomId, note } = noteData;

    // If the room doesn't have sticky notes, initialize it
    if (!stickyNotesPerRoom[roomId]) {
      stickyNotesPerRoom[roomId] = [];
    }

    // Add the new sticky note to the room
    stickyNotesPerRoom[roomId].push(note);

    // Broadcast the new sticky note to all users in the room
    io.to(roomId).emit('syncStickyNotes', stickyNotesPerRoom[roomId]);
  });


  // Handle sticky note updates (e.g., moving or editing a note)
  socket.on('updateStickyNote', ({ roomId, note }) => {
    const notesInRoom = stickyNotesPerRoom[roomId] || [];
    const index = notesInRoom.findIndex(n => n.id === note.id);
    if (index !== -1) {
      notesInRoom[index] = note; // Update the sticky note
      io.to(roomId).emit('syncStickyNotes', notesInRoom);
    }
  });

  socket.on('deleteStickyNote', ({ roomId, noteId }) => {
    const notesInRoom = stickyNotesPerRoom[roomId] || [];
    const updatedNotes = notesInRoom.filter(note => note.id !== noteId);
    stickyNotesPerRoom[roomId] = updatedNotes;
    io.to(roomId).emit('syncStickyNotes', updatedNotes);
  });

  socket.on('screenSignal', (payload) => {
    socket.to(payload.roomId).emit('screenSignal', {
      signal: payload.signal,
      callerID: socket.id,
    });
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    rooms.forEach((value, key) => {
      if (value.includes(socket.id)) {
        rooms.set(key, value.filter(id => id !== socket.id));
        if (rooms.get(key).length === 0) {
          rooms.delete(key);
        }
      }
    });
    socket.broadcast.emit('user left', socket.id);
  });
});

// Use Railway-provided PORT
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
