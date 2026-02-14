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
const socket=require("./bullmq/socket");

const { connectKafka } = require("./kafka/kafka");
const { startChatConsumer } = require("./kafka/chatconsumer");
const chatRoutes = require("./routes/chat");

// 1. You need these imports (You already had them)
const http = require("http");

const app = express();

// Parse JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. CREATE THE HTTP SERVER (Crucial Step: Wrap express app)
const server = http.createServer(app);
socket(server); 


// CORS configuration from environment
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',') 
  : ['http://localhost:3000'];

app.use(cors({ 
  origin: allowedOrigins,
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



app.use("/chat", chatRoutes);

app.post("/post/service", auth, upload.array("images", 5), postServices);

app.get("/", (req, res) => {
    res.send("Welcome to the Copy Backend Server");
});

// 4. START SERVER (Change 'app.listen' to 'server.listen')
// This ensures both the API and WebSockets run on the configured port
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Server accessible at http://0.0.0.0:${PORT}`);
});