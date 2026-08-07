// server_side/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const registerBoardSocket = require("./socket/boardSocket");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Initialize Socket.IO with CORS enabled
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Your Vite dev server URL
    methods: ["GET", "POST"],
  },
});

// Register socket handlers
registerBoardSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});