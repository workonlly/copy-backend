// const Razorpay = require("razorpay");
// const crypto = require("crypto");
// const express = require("express");
// const router = express.Router();

// // 1. Initialize Razorpay
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// // 2. Route: Create Order
// router.post("/payment/order", async (req, res) => {
//   try {
//     const { amount } = req.body; // Amount in RUPEES

//     const options = {
//       amount: amount * 100, // Razorpay takes amount in PAISE (₹1 = 100 paise)
//       currency: "INR",
//       receipt: `receipt_${Date.now()}`,
//     };

//     const order = await razorpay.orders.create(options);
//     res.json(order);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // 3. Route: Verify Payment (The most important step for security)
// router.post("/payment/verify", async (req, res) => {
//   try {
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

//     // Create the expected signature using your Secret Key
//     const body = razorpay_order_id + "|" + razorpay_payment_id;
//     const expectedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(body.toString())
//       .digest("hex");

//     const isAuthentic = expectedSignature === razorpay_signature;

//     if (isAuthentic) {
//       // ✅ Payment Success: Save to Database here
//       // await pool.query("UPDATE jobs SET status = 'paid' WHERE ...")
      
//       res.json({ message: "Payment verified successfully", success: true });
//     } else {
//       res.status(400).json({ message: "Invalid signature", success: false });
//     }
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });