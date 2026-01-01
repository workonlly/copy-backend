const express=require("express");
const cors=require("cors");
const authroutes=require("./routes/auth");
const auth=require("./middleware/auth");
const pool=require("./config/db");
const app=express();

app.use(cors({origin:'http://localhost:3000'}));
app.use(express.json());
app.use("/api/auth",authroutes);

app.get('/api/profile', auth, async (req, res) => {
  res.json({ user: req.user });
});

app.listen(3000,(res,req)=>{
    console.log("server is running on port 3000");
})

