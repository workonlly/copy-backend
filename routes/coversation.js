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
        // We pass the 'knownIds' array directly to $1. 
        // Postgres will treat it as an array to match against 'id'.
        const friendsResult = await pool.query(
            "SELECT id, name, email FROM users WHERE id = ANY($1::int[])",
            [knownIds]
        );

        // 4. Send the result (Array of users)
        res.json(friendsResult.rows);

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


router.get("/conversation/:id", auth, async (req, res) => {
    const id = req.params.id;
    const user=req.user.id;
    const data = await pool.query("SELECT * FROM conversations WHERE user_id=$1 AND conversant_id=$2 ORDER BY created_at DESC", [id,user]);
    res.json(data.rows);
});

module.exports=router;