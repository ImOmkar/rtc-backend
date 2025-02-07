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
    } else {
      socket.emit("error", "Room does not exist!");
    }
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

  socket.on("disconnect", () => {
    console.log("❌ User disconnected");
  });
});


// Use Railway-provided PORT
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
