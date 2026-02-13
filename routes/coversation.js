const express= require("express");
const pool =require("../config/db");
const auth = require("../middleware/auth");
const router=express.Router();

router.get("/", auth, async (req, res) => {
    const userId = req.user.id;

    try {
        // 1. Fetch the 'known_id' list for the current user
        const userResult = await pool.query(
            "SELECT known_id FROM users WHERE id = $1",
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        // Because column is JSON, this is automatically a JS Array (e.g., [101, 102])
        const knownIds = userResult.rows[0].known_id;

        // 2. Handle case where user has no contacts (array is null or empty)
        if (!knownIds || knownIds.length === 0) {
            return res.json([]); // Return empty list immediately
        }

        // 3. Fetch details for ALL users in that list in ONE query
        // Include image_url for profile pictures
        const friendsResult = await pool.query(
            "SELECT id, name, email, image_url FROM users WHERE id = ANY($1::int[])",
            [knownIds]
        );

        // 4. Send the result (Array of users with image_url as 'image' for frontend compatibility)
        const contacts = friendsResult.rows.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image_url // Map image_url to image for frontend
        }));

        res.json(contacts);

    } catch (err) {
        console.error("Error fetching conversations:", err.message);
        res.status(500).json({ message: "Server error fetching conversations" });
    }
});

router.get("/review/:id", auth, async (req, res) => {
    const id = req.params.id;
    const data = await pool.query("SELECT * FROM comments WHERE user_id=$1", [id]);
    res.json(data.rows);
});

router.get("/conversation/:receiverId", auth, async (req, res) => {
    const receiverId = parseInt(req.params.receiverId);
    const userId = req.user.id;

    try {
        const data = await pool.query(
            `SELECT *
             FROM conversations
             WHERE (user_id = $1 AND conversant_id = $2)
                OR (user_id = $2 AND conversant_id = $1)
             ORDER BY created_at DESC`,
            [userId, receiverId]
        );

        // Parse conversation JSONB into individual message objects
        const messages = [];
        
        if (data.rows.length > 0) {
            const row = data.rows[0]; // Get the conversation room
            
            if (row.conversation && typeof row.conversation === 'object') {
                // Convert JSONB object to array of message objects
                // Each key is a timestamp, value is either string or object with sender_id
                for (const [timestamp, messageData] of Object.entries(row.conversation)) {
                    let messageText;
                    let senderId;
                    
                    // Handle both old format (string) and new format (object with sender_id)
                    if (typeof messageData === 'string') {
                        messageText = messageData;
                        // For old messages without sender_id, we can't determine sender
                        senderId = null;
                    } else if (typeof messageData === 'object' && messageData !== null) {
                        messageText = messageData.message;
                        senderId = messageData.sender_id;
                    }
                    
                    messages.push({
                        room_id: row.room_id,
                        conversation: { [timestamp]: messageText },
                        created_at: timestamp,
                        sender_id: senderId,
                        user_id: row.user_id,
                        conversant_id: row.conversant_id,
                        chat_recharge: row.chat_recharge,
                        recharge_expires_at: row.recharge_expires_at
                    });
                }
                
                // Sort by timestamp (oldest first)
                messages.sort((a, b) => 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
            }
        }

        res.json(messages);
    } catch (err) {
        console.error("Error fetching conversation:", err.message);
        res.status(500).json({ message: "Server error fetching conversation" });
    }
});

router.post("/recharge", auth, async (req, res) => {
  const { room_id } = req.body;

  try {
    // 1. Activate Recharge
    // 2. Set Expiry to 24 Hours from NOW
    const result = await pool.query(
      `UPDATE conversations 
       SET chat_recharge = TRUE, 
           recharge_expires_at = NOW() + INTERVAL '24 hours' 
       WHERE room_id = $1 
       RETURNING *`,
      [room_id]
    );

    res.json({ success: true, message: "Recharge Successful", data: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Recharge failed" });
  }
});

module.exports=router;