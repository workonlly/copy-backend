const express=require("express");
const router=express.Router();
const pool=require("../config/db");

router.get("/assignment",async(req,res)=>{
    const data=await pool.query("SELECT * FROM jobs WHERE type='Assignment'");
     res.json(data.rows);
     
});
router.get("/rental",async(req,res)=>{
    const data=await pool.query("SELECT * FROM jobs WHERE type='Rental'");
     res.json(data.rows);
});
router.get("/notes",async(req,res)=>{
   const data=await pool.query("SELECT * FROM jobs WHERE type='Notes'");
     res.json(data.rows);
});
router.get("/canteen",async(req,res)=>{
      const data=await pool.query("SELECT * FROM jobs WHERE type='Canteen'");
     res.json(data.rows);
});
router.get("/:id",async(req,res)=>{
    const data=await pool.query("SELECT * FROM jobs WHERE user_id=$1 ",[req.params.id]);
     res.json(data.rows);
});
router.get("/assign/:id",async(req,res)=>{
    const data=await pool.query("SELECT * FROM jobs WHERE assigned_user_id=$1",[req.params.id]);
     res.json(data.rows);
});
router.get("/bids/:id",async(req,res)=>{
    const data=await pool.query("SELECT * FROM bids WHERE bidder_id=$1 ",[req.params.id]);
     res.json(data.rows);
});
router.delete("/work/:id",async(req,res)=>{
     const data=await pool.query("DELETE FROM jobs WHERE id=$1 ",[req.params.id]);
     res.json({message:"Job Deleted Successfully"});
});
router.get("/work/:id",async(req,res)=>{
    const data=await pool.query("SELECT * FROM jobs WHERE id=$1 ",[req.params.id]);
     res.json(data.rows);
});


module.exports=router;