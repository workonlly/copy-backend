// workers/chatConsumer.js
const pool = require("../config/db");
const { consumer } = require("./kafka");

const startChatConsumer = async (io) => {
  // Subscribe to the "chat-messages" topic
  await consumer.subscribe({ topic: "chat-messages", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        // 1. Parse the message from Kafka
        const payload = JSON.parse(message.value.toString());
        const { user_id, conversant_id, conversation, created_at } = payload;

        console.log(`📩 Processing message: ${conversation}`);

        // 2. Save to Database (Postgres)
        const query = `
          INSERT INTO conversations (user_id, conversant_id, conversation, created_at)
          VALUES ($1, $2, $3, $4)
          RETURNING id;
        `;
        const dbRes = await pool.query(query, [user_id, conversant_id, conversation, created_at]);
        
        // Add the new DB ID to the message
        const finalMessage = { ...payload, id: dbRes.rows[0].id };

        // 3. INSTANT DELIVERY (Socket.io)
        // Push to the Receiver's Room
        io.to(conversant_id.toString()).emit("receive_message", finalMessage);
        
        // Push to the Sender's Room (so they see the checkmark/update)
        io.to(user_id.toString()).emit("message_sent", finalMessage);

      } catch (err) {
        console.error("❌ Worker Error:", err);
      }
    },
  });
};

module.exports = { startChatConsumer };