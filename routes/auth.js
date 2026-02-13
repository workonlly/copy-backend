const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const multer = require("multer");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/minio");
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
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
      const bucketName = process.env.S3_BUCKET_NAME;
      const fileName = `${Date.now()}-${file.originalname}`;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await s3Client.send(command);

      imageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
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

router.post("/google", async (req, res) => {
  const { token } = req.body;

  // Validate token is provided
  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    // A. Verify the token with Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email, name, picture } = ticket.getPayload();

    // B. Check if user exists in YOUR DB
    const userCheck = await pool.query("SELECT id, email, name, image_url FROM users WHERE email = $1", [email]);
    let user = userCheck.rows[0];

    // C. If not, create them (Sign Up)
    if (!user) {
      try {
        const newUser = await pool.query(
          "INSERT INTO users (name, email, image_url) VALUES ($1, $2, $3) RETURNING id, email, name, image_url",
          [name, email, picture]
        );
        user = newUser.rows[0];
      } catch (dbErr) {
        console.error("Database insert error:", dbErr);
        return res.status(500).json({ error: "Failed to create user" });
      }
    }

    // D. Generate YOUR App's Token
    const appToken = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET, 
      { expiresIn: "7d" }
    );

    // E. Send back the token + user data (sanitized)
    res.status(200).json({ 
      token: appToken, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image_url: user.image_url
      }
    });

  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(400).json({ error: "Google verification failed" });
  }
});

module.exports = router;
