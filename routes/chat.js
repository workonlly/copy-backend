// routes/chat.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { producer } = require("../kafka/kafka");
const auth = require("../middleware/auth"); // Your existing auth middleware

// POST /chat/send
router.post("/checkchat", auth, async (req, res) => {
  try {
    const { user1, user2 } = req.body;

    if (!user1 || !user2) {
      return res.status(400).json({ message: "Missing user IDs" });
    }

    // Convert to integers
    const userId = parseInt(user1);
    const conversantId = parseInt(user2);

    // Use JavaScript to handle the array logic instead of complex SQL
    const userResult = await pool.query(
      "SELECT id, known_id FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    let knownIds = userResult.rows[0].known_id || [];
    
    // If knownIds is a string, parse it
    if (typeof knownIds === 'string') {
      knownIds = JSON.parse(knownIds);
    }

    // Add conversantId if not already present
    if (!knownIds.includes(conversantId)) {
      knownIds.push(conversantId);
    }

    // Update the user with the new known_id array
    const updateResult = await pool.query(
      "UPDATE users SET known_id = $1 WHERE id = $2 RETURNING *",
      [JSON.stringify(knownIds), userId]
    );

    res.json({ message: "Chat list updated", known_id: updateResult.rows[0].known_id });

  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});


router.post("/send", auth, async (req, res) => {
  const { conversant_id, message } = req.body;
  const user_id = req.user.id; // From auth middleware

  if (!conversant_id || !message) {
    return res.status(400).json({ msg: "Missing fields" });
  }

  try {
    const payload = {
      user_id,
      conversant_id,
      conversation: message,
      created_at: new Date().toISOString(),
    };

    // ⚡️ FAST: Push to Kafka (Don't wait for DB)
    await producer.send({
      topic: "chat-messages",
      messages: [{ value: JSON.stringify(payload) }],
    });

    // Respond instantly
    res.json({ status: "Message Queued" });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;