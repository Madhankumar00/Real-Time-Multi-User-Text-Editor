import { Server } from "socket.io";
import express from "express";
import cors from "cors";
import http from "http";

const port = 8081;
const app = express();

app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("user is connected:", socket.id);

  // Notify ALL other users that this user connected
  socket.broadcast.emit("user-connected", socket.id);

  // Handle offer (can be targeted or broadcast)
  socket.on("offer", (data) => {
    console.log("routing offer");
    // console.log("offer data:", data);
    if (data.to) {
      // Send to specific peer
      io.to(data.to).emit("offer", {
        sdp: data.sdp,
        from: socket.id,
      });
    } else {
      // Broadcast to all
      socket.broadcast.emit("offer", {
        sdp: data,
        from: socket.id,
      });
    }
  });

  // Handle answer (can be targeted or broadcast)
  socket.on("answer", (data) => {
    console.log("routing answer");
    // console.log("answer data:", data);
    if (data.to) {
      // Send to specific peer
      io.to(data.to).emit("answer", {
        sdp: data.sdp,
        from: socket.id,
      });
    } else {
      // Broadcast to all
      socket.broadcast.emit("answer", {
        sdp: data,
        from: socket.id,
      });
    }
  });

  // Handle ICE candidates (can be targeted or broadcast)
  socket.on("icecandidate", (data) => {
    console.log("routing ice candidates");
    // console.log("candidate data:", data);
    if (data.to) {
      // Send to specific peer
      io.to(data.to).emit("icecandidate", {
        candidate: data.candidate,
        from: socket.id,
      });
    } else {
      // Broadcast to all
      socket.broadcast.emit("icecandidate", {
        candidate: data,
        from: socket.id,
      });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("user disconnected:", socket.id);
    socket.broadcast.emit("user-disconnected", socket.id);
  });
});

server.listen(port, () => {
  console.log(`app listening on port ${port}`);
});