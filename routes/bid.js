const express=require("express");
const router=express.Router();
const auth=require("../middleware/auth");
const pool=require("../config/db");

router.post("/", auth, async (req, res) => {
  const { job_id, amount, message } = req.body;
  const bidder_id = req.user.id; 

  if (!job_id || !amount) {
    return res.status(400).json({ message: "Job ID and Amount are required." });
  }

  try {
    // 1. Check if the JOB exists in the 'jobs' table
    // (Also getting user_id to check if you are the owner)
    const jobCheck = await pool.query("SELECT id FROM jobs WHERE id = $1", [job_id]);

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ message: "Job not found." });
    }

    const jobOwnerId = jobCheck.rows[0].user_id;

    // 2. Prevent User from bidding on their OWN job
    if (jobOwnerId === bidder_id) {
      return res.status(400).json({ message: "You cannot bid on your own job." });
    }

    // 3. Check for existing bid (Prevent duplicate bids)
    const existingBid = await pool.query(
      "SELECT id FROM bids WHERE job_id = $1 AND bidder_id = $2",
      [job_id, bidder_id]
    );

    if (existingBid.rows.length > 0) {
      return res.status(400).json({ message: "You have already placed a bid on this job." });
    }

    // 4. Insert the New Bid
    const insertQuery = `
      INSERT INTO bids (job_id, bidder_id, amount, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const result = await pool.query(insertQuery, [
      job_id,
      bidder_id,
      amount,
      message || "" 
    ]);

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("BID ERROR:", err.message);
    res.status(500).json({ message: "Server error while placing bid." });
  }
});
router.get("/job/:id", async (req, res) => {
    const { id } = req.params;
    const data = await pool.query("SELECT * FROM bids WHERE job_id = $1", [id]);
    res.json(data.rows);
});
router.get("/bidder/:id", async (req, res) => {
    const { id } = req.params;
    const data = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    res.json(data.rows);
});

// DELETE /bids/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const bidId = req.params.id;
    const userId = req.user.id; // From JWT token

    // Verify the bid belongs to this user
    const bid = await db.query(
      'SELECT * FROM bids WHERE id = ? AND bidder_id = ?',
      [bidId, userId]
    );

    if (bid.length === 0) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    // Delete the bid
    await db.query('DELETE FROM bids WHERE id = ?', [bidId]);

    res.json({ message: 'Bid deleted successfully' });
  } catch (error) {
    console.error('Error deleting bid:', error);
    res.status(500).json({ error: 'Failed to delete bid' });
  }
});

router.put("/assigning/:id", auth, async (req, res) => {
    const { id } = req.params;
    const {job_id}=req.body;
    const data = await pool.query("UPDATE jobs SET assigned_user_id=$1 WHERE id=$2 RETURNING *",[id,job_id]);
    if (data.rowCount > 0) {
      await pool.query("UPDATE jobs SET progress=$1 WHERE id=$2", ["pending", job_id]);
    }
    res.json(data.rows[0]);
});

module.exports=router;