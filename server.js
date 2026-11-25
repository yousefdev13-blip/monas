const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const activeStudents = new Map();

app.use(express.static(path.join(__dirname, "public")));

function getOnlineCount() {
  return io.engine.clientsCount;
}

function broadcastPresence() {
  io.emit("online:count", { count: getOnlineCount() });
}

io.on("connection", (socket) => {
  console.log(`Connected: ${socket.id}`);
  broadcastPresence();

  // study:presence — a learner starts or stops a study session.
  socket.on("study:presence", (payload = {}) => {
    const name = cleanName(payload.name);
    const studying = Boolean(payload.studying);

    if (studying) {
      activeStudents.set(socket.id, name);
    } else {
      activeStudents.delete(socket.id);
    }

    socket.broadcast.emit("study:presence", {
      name,
      studying,
      activeCount: activeStudents.size,
      message: studying ? `${name} started studying` : `${name} left the study session`
    });
  });

  // study:activity — broadcast meaningful learning actions to everyone else.
  socket.on("study:activity", (payload = {}) => {
    const name = cleanName(payload.name);
    const action = String(payload.action || "is studying").slice(0, 80);
    const card = Number.isInteger(payload.card) ? payload.card : null;

    socket.broadcast.emit("study:activity", {
      name,
      action,
      card,
      message: `${name} ${action}`,
      at: new Date().toISOString()
    });
  });

  // study:finish — announce that a learner completed their study session.
  socket.on("study:finish", (payload = {}) => {
    const name = cleanName(payload.name);
    const total = Math.max(0, Number(payload.total) || 0);
    const correct = Math.max(0, Number(payload.correct) || 0);

    activeStudents.delete(socket.id);
    io.emit("study:finish", {
      name,
      total,
      correct,
      message: `${name} finished a study session (${correct}/${total})`,
      at: new Date().toISOString()
    });
  });

  socket.on("disconnect", () => {
    activeStudents.delete(socket.id);
    console.log(`Disconnected: ${socket.id}`);
    broadcastPresence();
  });
});

function cleanName(value) {
  const name = String(value || "Guest").trim().slice(0, 24);
  return name || "Guest";
}

server.listen(PORT, () => {
  console.log(`Flashcard app running at http://localhost:${PORT}`);
});