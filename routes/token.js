const express= require("express");
const router=express.Router();
const pool=require("../config/db");
const auth = require("../middleware/auth");
 
router.put("/minusone",auth, async (req, res) => {
const id = req.user.id;
try {
    // Check current tokens
    const userResult = await pool.query("SELECT tokens FROM users WHERE id = $1", [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const currentTokens = userResult.rows[0].tokens;
    if (currentTokens < 1) {
      return res.status(400).json({ message: "insufficient token" });
    }
    const result = await pool.query(
      "UPDATE users SET tokens = tokens - 1 WHERE id = $1 RETURNING tokens",
      [id]
    );
    res.json({ tokens: result.rows[0].tokens });
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});
router.put("/minusfive",auth, async (req, res) => {
const id = req.user.id;
try {
    // Check current tokens
    const userResult = await pool.query("SELECT tokens FROM users WHERE id = $1", [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const currentTokens = userResult.rows[0].tokens;
    if (currentTokens < 5) {
      return res.status(400).json({ message: "insufficient token" });
    }
    const result = await pool.query(
      "UPDATE users SET tokens = tokens - 5 WHERE id = $1 RETURNING tokens",
      [id]
    );
    res.json({ tokens: result.rows[0].tokens });
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

module.exports=router;

