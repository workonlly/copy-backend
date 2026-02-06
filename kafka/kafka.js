// config/kafka.js
const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "chat-app",
  brokers: ["localhost:9092"], // This connects to your Docker container
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "chat-group" });

const connectKafka = async () => {
  try {
    await producer.connect();
    await consumer.connect();
    console.log("✅ Kafka Connected Successfully");
  } catch (err) {
    console.error("❌ Kafka Connection Failed:", err);
  }
};

module.exports = { kafka, producer, consumer, connectKafka };