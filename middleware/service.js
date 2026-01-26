const pool =require("../config/db");

const getServices=async(req,res,next)=>{
     const data=await pool.query("SELECT * FROM jobs");
     req.services=data.rows;
     next();
}
module.exports=getServices;