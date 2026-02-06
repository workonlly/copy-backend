const express = require("express");
const cors = require("cors");
const multer = require("multer"); 
const payment = require("./routes/razorpay");
const upload = multer({ storage: multer.memoryStorage() });
const calls = require("./routes/services");
const updatecalls = require("./routes/service_update");
const authroutes = require("./routes/auth");
const bids = require("./routes/bid");
const auth = require("./middleware/auth");
const conversation = require("./routes/coversation");
const { postServices } = require("./middleware/postservice");
const tokenRoutes = require("./routes/token");

const { connectKafka } = require("./kafka/kafka");
const { startChatConsumer } = require("./kafka/chatconsumer");
const chatRoutes = require("./routes/chat");

// 1. You need these imports (You already had them)
const http = require("http");
const { Server } = require("socket.io");

const app = express();

// Parse JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. CREATE THE HTTP SERVER (Crucial Step: Wrap express app)
const server = http.createServer(app);

// 3. INITIALIZE SOCKET.IO (Define 'io' here)
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',           // Local dev
      'http://10.132.159.29:3000',      // Your network IP
      'http://192.168.77.29:3000'       // Other IPs you use
    ],
    credentials: true
  }
});

app.use(cors({ 
  origin: [
    'http://localhost:3000',
    'http://10.132.159.29:3000',
    'http://192.168.77.29:3000'
  ],
  credentials: true 
}));
// --- ROUTES ---
app.use("/calls", calls);
app.use("/auth", authroutes);
app.use("/updatecalls", updatecalls);
app.use("/bids", bids);
app.use("/conversation", conversation);
app.use("/payment", tokenRoutes);
app.use("/chats", chatRoutes);

app.get('/api/profile', auth, async (req, res) => {
  res.json({ user: req.user });
});

// --- SOCKET LOGIC ---
io.on("connection", (socket) => {
  console.log("Socket Connected:", socket.id);

  // Join Personal Room
  socket.on("join_room", (userId) => {
    socket.join(userId.toString());
    console.log(`User ${userId} joined room ${userId}`);
  });

  socket.on("disconnect", () => console.log("Socket Disconnected"));
});

// --- KAFKA & WORKER ---
connectKafka().then(() => {
  startChatConsumer(io); // Pass the socket instance to the worker!
});

app.use("/chat", chatRoutes);

app.post("/post/service", auth, upload.array("images", 5), postServices);

app.get("/", (req, res) => {
    res.send("Welcome to the Copy Backend Server");
});

// 4. START SERVER (Change 'app.listen' to 'server.listen')
// This ensures both the API and WebSockets run on port 4000
server.listen(4000, '0.0.0.0', () => {
    console.log("server is running on port 4000");
    console.log("Server accessible at http://10.132.159.29:4000");
});