// kafka/chatWorker.js
const { Worker } = require("bullmq");
const pool = require("../config/db"); // Your database connection

// 1. Define the Worker logic
const initChatWorker = () => {
  console.log("Worker listening for messages...");

  const worker = new Worker("chat-queue", async (job) => {
    // This runs for every message added to the queue
    const { room_id, conversation, sender_id, receiver_id, created_at } = job.data;

    try {
      console.log(`📥 Processing message for Room: ${room_id}`);
      console.log(`📝 Message content:`, JSON.stringify(conversation));

      // Check if conversation exists for this room
      const existingConv = await pool.query(
        "SELECT id, conversation FROM conversations WHERE room_id = $1",
        [room_id]
      );

      if (existingConv.rows.length > 0) {
        // Room exists - Update conversation
        console.log(`📂 Room exists, updating conversation...`);
        console.log(`📊 Current conversation:`, existingConv.rows[0].conversation);
        
        // Use COALESCE to handle NULL - if conversation is NULL, start with empty object
        // Don't stringify - let PostgreSQL handle the JSONB conversion
        const query = `
          UPDATE conversations 
          SET conversation = COALESCE(conversation, '{}'::jsonb) || $2::jsonb
          WHERE room_id = $1
          RETURNING conversation
        `;
        const result = await pool.query(query, [room_id, conversation]);
        console.log(`✅ Updated! New conversation:`, result.rows[0].conversation);
      } else {
        // Create new conversation
        console.log(`🆕 Creating new conversation room...`);
        const insertQuery = `
          INSERT INTO conversations (room_id, user_id, conversant_id, conversation, chat_recharge, created_at)
          VALUES ($1, $2, $3, $4::jsonb, $5, $6)
          RETURNING id, conversation
        `;
        const result = await pool.query(insertQuery, [
          room_id,
          sender_id,
          receiver_id,
          conversation,
          false,
          created_at
        ]);
        console.log(`✅ Created! Conversation:`, result.rows[0].conversation);
      }
      
      console.log(`💾 Message saved to DB!`);
    } catch (err) {
      console.error("❌ Worker failed:", err.message);
      console.error("Stack:", err.stack);
      throw err; // BullMQ will retry automatically
    }
  }, { 
    connection: { 
      host: process.env.REDIS_HOST || "localhost", 
      port: parseInt(process.env.REDIS_PORT) || 6379, 
      family: 4 
    }
  });

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`❌ Worker error:`, err.message);
  });

  return worker;
};

module.exports = { initChatWorker };