const pool = require("../config/db");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/minio");


const getS3KeyFromUrl = (url) => {
    if (!url) return null;
    const parts = url.split('/');
    return parts[parts.length - 1];
};

// --- POST SERVICE ---
const postServices = async (req, res) => {
    // 1. Get User ID from Token (set by 'auth' middleware)
    const user_id = req.user ? req.user.id : null; 
    
    if (!user_id) {
        return res.status(401).json({ error: "Unauthorized: User ID missing" });
    }

    const { type, heading, description, deadline, location, cost, links, progress } = req.body;
    const files = req.files;

    try {
        // 2. Upload Images to MinIO
        let imageUrls = [];
        if (files && files.length > 0) {
            const bucketName = 'copywrightimg';
            const uploadPromises = files.map(async (file) => {
                // Sanitize filename
                const fileName = `job-${Date.now()}-${file.originalname.replace(/\s/g, '_')}`;
                
                await s3Client.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key: fileName,
                    Body: file.buffer,
                    ContentType: file.mimetype,
                }));
                // Construct URL
                return `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${bucketName}/${fileName}`;
            });
            imageUrls = await Promise.all(uploadPromises);
        }

        // 3. Database Insertion
        const queryText = `
            INSERT INTO jobs (
                user_id, type, heading, description, deadline, 
                location, cost, image_url, links, progress
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *;
        `;

        // Data Sanitization to prevent SQL crashes
        const values = [
            user_id,
            type || 'Assignment',
            heading,
            description || null,
            deadline && deadline !== "" ? deadline : null, // Fix empty string date crash
            location || null,
            cost && cost !== "" ? parseFloat(cost) : 0,
            imageUrls, // Array of URL strings
            links ? (Array.isArray(links) ? links : [links]) : null,
            progress || 'initiated'
        ];

        const result = await pool.query(queryText, values);
        
        // Success Response
        res.status(201).json({ 
            message: "Service posted successfully", 
            job: result.rows[0] 
        });

    } catch (err) {
        console.error("POST_SERVICES_ERROR:", err.message);
        res.status(500).json({ error: "Database Insertion Failed", details: err.message });
    }
};

// --- PUT SERVICE ---
const putServices = async (req, res) => {
    const { id } = req.params; 
    const { 
        type, heading, description, deadline, 
        location, cost, links, progress, imagesToRemove 
    } = req.body;
    const newFiles = req.files;

    try {
        const jobResult = await pool.query("SELECT * FROM jobs WHERE id = $1", [id]);
        if (jobResult.rows.length === 0) return res.status(404).json({ error: "Job not found" });

        // Ensure user owns the post (Optional security check)
        // if (req.user.id !== jobResult.rows[0].user_id) return res.status(403).json({ error: "Unauthorized" });

        let currentImages = jobResult.rows[0].image_url || [];

        // 1. Delete removed images from MinIO
        if (imagesToRemove) {
            const toRemove = Array.isArray(imagesToRemove) ? imagesToRemove : [imagesToRemove];
            const bucketName = 'copywrightimg';
            
            const deletePromises = toRemove.map(async (url) => {
                const key = getS3KeyFromUrl(url);
                if (key) await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
            });
            await Promise.all(deletePromises);
            
            // Filter local array
            currentImages = currentImages.filter(url => !toRemove.includes(url));
        }

        // 2. Upload new images
        if (newFiles && newFiles.length > 0) {
            const bucketName = 'copywrightimg';
            const uploadPromises = newFiles.map(async (file) => {
                const fileName = `job-${Date.now()}-${file.originalname.replace(/\s/g, '_')}`;
                await s3Client.send(new PutObjectCommand({
                    Bucket: bucketName, Key: fileName, Body: file.buffer, ContentType: file.mimetype,
                }));
                return `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${bucketName}/${fileName}`;
            });
            const newImageUrls = await Promise.all(uploadPromises);
            currentImages = [...currentImages, ...newImageUrls];
        }

        // 3. Update Database
        const updateQuery = `
            UPDATE jobs 
            SET type = COALESCE($1, type),
                heading = COALESCE($2, heading), 
                description = COALESCE($3, description),
                deadline = COALESCE($4, deadline),
                location = COALESCE($5, location),
                cost = COALESCE($6, cost),
                links = COALESCE($7, links),
                progress = COALESCE($8, progress),
                image_url = $9,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $10 RETURNING *;
        `;
        
        const values = [
            type, heading, description, 
            deadline && deadline !== "" ? deadline : null, 
            location, cost, links, progress, currentImages, id
        ];

        const finalResult = await pool.query(updateQuery, values);
        res.json({ message: "Job updated successfully", job: finalResult.rows[0] });

    } catch (err) {
        console.error("PUT_SERVICES_ERROR:", err.message);
        res.status(500).json({ error: "Update failed", details: err.message });
    }
};

module.exports = { postServices, putServices };