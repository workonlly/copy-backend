const express = require("express");
const cors = require("cors");
const multer = require("multer"); 
const payment=require("./routes/razorpay");
const upload = multer({ storage: multer.memoryStorage() });
const calls=require("./routes/services");
const updatecalls=require("./routes/service_update");
const authroutes = require("./routes/auth");
const bids=require("./routes/bid");
const auth = require("./middleware/auth");
const { postServices, putServices } = require("./middleware/postservice");
const getServices = require("./middleware/service");
const pool = require("./config/db");
const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.use("/calls", calls);
app.use("/auth", authroutes);
app.use("/updatecalls", updatecalls);
app.use("/bids", bids);
app.get('/api/profile', auth, async (req, res) => {
  res.json({ user: req.user });
});

app.get("/post/service", getServices, async (req, res) => {
   res.json(req.services);
});


// 3. NOW 'upload' IS DEFINED, SO THIS WORKS:
app.post("/post/service", auth, upload.array("images", 5), postServices);

app.put("/post/service/:id", auth, upload.array("images", 5), putServices);

app.get("/", (req, res) => {
    res.send("Welcome to the Copy Backend Server");
});

app.listen(4000, () => {
    console.log("server is running on port 4000");
});