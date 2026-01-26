const express = require("express");
const pool = require("../config/db"); 
const multer = require("multer");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/minio"); 
const router = express.Router();

// 1. Import Middleware
const auth = require("../middleware/auth");

const upload = multer({ storage: multer.memoryStorage() });

/**
 * UPDATE CALL / POST
 * Method: PUT
 * Route: /updatecalls/:id
 */
// 2. Added 'auth' before 'upload.array'
// Order matters! auth checks token first, then upload processes files.
router.put("/:id", auth, upload.array("images"), async (req, res) => {
  const { id } = req.params;
  const bucketName = "copywrightimg"; 

  try {
    const postQuery = await pool.query("SELECT * FROM jobs WHERE id = $1", [id]);

    if (postQuery.rows.length === 0) {
      return res.status(404).json({ msg: "Post not found" });
    }

    const post = postQuery.rows[0];

    // Authorization Check
    // This now works because 'auth' middleware populates 'req.user'
    if (post.user_id !== req.user.id) {
      return res.status(401).json({ msg: "Unauthorized action" });
    }

    // --- IMAGE MANAGEMENT ---
    let imagesToDelete = req.body.imagesToRemove || [];
    if (!Array.isArray(imagesToDelete)) {
      imagesToDelete = [imagesToDelete];
    }

    let updatedImageUrls = (post.image_url || []).filter(
      (url) => !imagesToDelete.includes(url)
    );

    // Delete removed images from MinIO
    if (imagesToDelete.length > 0) {
      for (const url of imagesToDelete) {
        try {
          const fileName = url.split("/").pop(); 
          await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: fileName }));
        } catch (err) {
          console.error("Failed to delete image from MinIO:", err);
        }
      }
    }

    // Upload New Images
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileName = `${Date.now()}-${file.originalname}`;
        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype,
        }));
        updatedImageUrls.push(`http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${bucketName}/${fileName}`);
      }
    }

    // --- LINKS & DB UPDATE ---
    let updatedLinks = req.body.links || [];
    if (!Array.isArray(updatedLinks)) updatedLinks = [updatedLinks];
    updatedLinks = updatedLinks.filter(link => link.trim() !== "");

    const updateQuery = `
      UPDATE jobs 
      SET heading = $1, type = $2, description = $3, deadline = $4, cost = $5, links = $6, image_url = $7 
      WHERE id = $8 RETURNING *;
    `;

    const values = [
      req.body.heading, req.body.type, req.body.description, req.body.deadline, 
      req.body.cost, updatedLinks, updatedImageUrls, id
    ];

    const result = await pool.query(updateQuery, values);
    res.json(result.rows[0]);

  } catch (err) {
    console.error("UPDATE ERROR:", err.message);
    console.error("UPDATE ERROR STACK:", err.stack);
    res.status(500).json({ msg: "Server error while updating post", error: err.message });
  }
});

/**
 * DELETE POST
 */
// 3. Added 'auth' here as well
router.delete("/:id", auth, async (req, res) => {
    const { id } = req.params;
    const bucketName = "copywrightimg"; 

    try {
        const postQuery = await pool.query("SELECT * FROM jobs WHERE id = $1", [id]);

        if (postQuery.rows.length === 0) {
            return res.status(404).json({ msg: "Post not found" });
        }

        const post = postQuery.rows[0];

        // 4. ADDED SECURITY CHECK HERE
        // Prevents user A from deleting user B's post
        if (post.user_id !== req.user.id) {
            return res.status(401).json({ msg: "Unauthorized action" });
        }

        // Cleanup Images
        if (post.image_url && post.image_url.length > 0) {
            for (const url of post.image_url) {
                try {
                    const fileName = url.split("/").pop(); 
                    await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: fileName }));
                } catch (err) {
                    console.error("Failed to delete image from S3:", err);
                }
            }
        }

        // Delete Row
        await pool.query("DELETE FROM jobs WHERE id = $1", [id]);

        res.json({ msg: "Post and associated images deleted successfully" });

    } catch (err) {
        console.error("DELETE ERROR:", err);
        res.status(500).json({ msg: "Server error while deleting post" });
    }
});

module.exports = router;