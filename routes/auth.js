const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const multer = require("multer");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/minio");

const router = express.Router();

// Multer config (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * SIGNUP
 */
router.post("/signup", upload.single("pic"), async (req, res) => {
  const { email, password, name } = req.body;
  const file = req.file;

  if (!email || !password || !name) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  let imageUrl = null;

  try {
    // 1. Check if email already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ msg: "Email already registered" });
    }

    // 2. Upload image to MinIO (if provided)
    if (file) {
      const bucketName = "accounts";
      const fileName = `${Date.now()}-${file.originalname}`;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await s3Client.send(command);

      imageUrl = `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${bucketName}/${fileName}`;
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Insert user into DB
    const result = await pool.query(
      `INSERT INTO users (email, password, name, image_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, image_url`,
      [email, hashedPassword, name, imageUrl]
    );

    // 5. Generate JWT
    const token = jwt.sign(
      { id: result.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: result.rows[0],
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ msg: "Signup failed" });
  }
});

/**
 * LOGIN
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: "Email and password required" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image_url: user.image_url,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
