// server_side/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const prisma = require("./config/db");
const registerBoardSocket = require("./socket/boardSocket");
const { configDotenv } = require("dotenv");

const app = express();
app.use(cors());
app.use(express.json());
configDotenv();

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

const PORT = process.env.PORT || 3000;
// Test DB Connection before starting HTTP server
async function main() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully via Prisma");

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  }
}

main();