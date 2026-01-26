const jwt =require("jsonwebtoken");
const pool=require("../config/db");

const auth=async(req,res,next)=>{
    try{
        const token=req.header("Authorization")?.replace("Bearer ","");
        if(!token)return res.status(401).json({message:"no tken found"});
        const decoded=jwt.verify(token,process.env.JWT_SECRET);
        const user =await pool.query('SELECT * FROM users WHERE id=$1',[decoded.id]);
        req.user=user.rows[0];
        next();
    }
    catch(err){
        res.status(401).json({message:"Unauthorized"});
    }

}

module.exports=auth;