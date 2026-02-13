// routes/chat.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { producer } = require("../kafka/kafka");
const auth = require("../middleware/auth"); // Your existing auth middleware
const crypto = require("crypto");

// POST /chat/checkchat
router.post("/checkchat", auth, async (req, res) => {
  try {
    const { user1, user2 } = req.body;

    if (!user1 || !user2) {
      return res.status(400).json({ message: "Missing user IDs" });
    }
    
    
    // Convert to integers
    const userId = parseInt(user1);
    const conversantId = parseInt(user2);

    // Fetch both users
    const userResult = await pool.query(
      "SELECT id, known_id FROM users WHERE id = $1 OR id = $2",
      [userId, conversantId]
    );

    if (userResult.rows.length < 2) {
      return res.status(404).json({ message: "One or both users not found" });
    }

    // Check if conversation already exists
    const existingConv = await pool.query(
      `SELECT room_id FROM conversations 
       WHERE (user_id = $1 AND conversant_id = $2) 
          OR (user_id = $2 AND conversant_id = $1)`,
      [userId, conversantId]
    );

    let chatroomId;
    if (existingConv.rows.length > 0) {
      // Conversation already exists
      chatroomId = existingConv.rows[0].room_id;
      console.log(`💬 Chat room already exists: ${chatroomId}`);
    } else {
      // Generate new UUID for this chat room
      const newRoomId = crypto.randomUUID();
      
      // Create new conversation
      const chatroom = await pool.query(
        "INSERT INTO conversations (user_id, conversant_id, room_id) VALUES ($1, $2, $3) RETURNING room_id",
        [userId, conversantId, newRoomId]
      );
      chatroomId = chatroom.rows[0].room_id;
      console.log(`🆕 Created new chat room: ${chatroomId}`);
    }

    // Update both users' known_id arrays
    for (const user of userResult.rows) {
      let knownIds = user.known_id || [];
      
      // If knownIds is a string, parse it
      if (typeof knownIds === 'string') {
        knownIds = JSON.parse(knownIds);
      }

      // Add the other user's ID if not already present
      const otherUserId = user.id === userId ? conversantId : userId;
      
      if (!knownIds.includes(otherUserId)) {
        knownIds.push(otherUserId);
        
        // Update this user's known_id
        await pool.query(
          "UPDATE users SET known_id = $1 WHERE id = $2",
          [JSON.stringify(knownIds), user.id]
        );
        console.log(`✅ Added user ${otherUserId} to user ${user.id}'s known_id list`);
      }
    }

    res.json({ 
      message: "Chat list updated for both users", 
      room_id: chatroomId 
    });

  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});


// router.post("/send", auth, async (req, res) => {
//   const { conversant_id, message } = req.body;
//   const user_id = req.user.id; // From auth middleware

//   if (!conversant_id || !message) {
//     return res.status(400).json({ msg: "Missing fields" });
//   }

//   try {
//     const payload = {
//       user_id,
//       conversant_id,
//       conversation: message,
//       created_at: new Date().toISOString(),
//     };

//     // ⚡️ FAST: Push to Kafka (Don't wait for DB)
//     await producer.send({
//       topic: "chat-messages",
//       messages: [{ value: JSON.stringify(payload) }],
//     });

//     // Respond instantly
//     res.json({ status: "Message Queued" });

//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Server Error");
//   }
// });




module.exports = router;