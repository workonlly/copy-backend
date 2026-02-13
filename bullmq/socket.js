// socket/socketManager.js
const { Server } = require("socket.io");
const { Queue } = require("bullmq");
const { initChatWorker } = require("./chatworker"); // Adjust path if needed

const setupSocket = (server) => {
  // 1. Start the Background Worker
  initChatWorker();

  // 2. Initialize the BullMQ Queue
  const chatQueue = new Queue("chat-queue", { 
    connection: { host: "localhost", port: 6379 ,family:4 } 
  });

  // 3. Database Pool for Expiry Checks
  const pool = require("../config/db");

  // 3. Initialize Socket.io
  const io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:3000',           // Local dev
        'http://10.132.159.29:3000',      // Network IP
        'http://192.168.77.29:3000'       // Other IPs
      ],
      credentials: true
    }
  });

  console.log("Socket Manager Initialized");

  // 4. Define Connection Logic
  io.on("connection", (socket) => {
    console.log("Socket Connected:", socket.id);

    // A. Join Room logic
    socket.on("join_room", (roomId) => {
      socket.join(roomId.toString());
      console.log(`Socket joined room ${roomId}`);
    });

    // B. Send Message Logic
    socket.on("send_message", async (data) => {
      const { room_id, conversation, sender_id, receiver_id, created_at, chat_recharge } = data;

      console.log(`📨 Received message from socket ${socket.id}:`, {
        room_id,
        sender_id,
        receiver_id,
        message: conversation
      });

      try {
        // Check if chat session is expired
        if (chat_recharge) {
          const checkExpiry = await pool.query(
            `SELECT recharge_expires_at FROM conversations 
             WHERE room_id = $1 AND recharge_expires_at IS NOT NULL`,
            [room_id]
          );

          if (checkExpiry.rows.length > 0) {
            const expiryDate = new Date(checkExpiry.rows[0].recharge_expires_at);
            const now = new Date();

            if (now > expiryDate) {
              // Session expired
              console.log(`⏰ Chat expired for room ${room_id}`);
              socket.emit("error_message", { 
                message: "Your chat plan has expired. Please recharge to continue." 
              });
              return; // Don't send or save the message
            }
          }
        }

        // Restructure conversation to include sender_id
        // Frontend sends: { "timestamp": "message" }
        // We need: { "timestamp": { "sender_id": X, "message": "..." } }
        const enrichedConversation = {};
        for (const [timestamp, messageText] of Object.entries(conversation)) {
          enrichedConversation[timestamp] = {
            sender_id: sender_id,
            message: messageText
          };
        }

        // Fast Path: Send to receiver immediately
        socket.to(room_id).emit("receive_message", data);
        console.log(`✅ Message broadcasted to room ${room_id}`);

        // Safe Path: Add to Queue for persistence with enriched conversation
        const job = await chatQueue.add("save-message", { 
          room_id, 
          conversation: enrichedConversation,
          sender_id,
          receiver_id,
          created_at
        });
        console.log(`📥 Message added to queue, Job ID: ${job.id}`);
      } catch (err) {
        console.error("❌ Send Message Error:", err.message);
        console.error("Stack:", err.stack);
        socket.emit("error_message", { message: "Failed to send message" });
      }
    });

    socket.on("disconnect", () => console.log("Socket Disconnected"));
  });

  return io; 
};

module.exports = setupSocket;