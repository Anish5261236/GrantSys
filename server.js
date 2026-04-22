const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); 

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Configure Multer for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"))
});
const upload = multer({ storage: storage });

// Connect MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/grantsys")
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

// Schema with Timestamps, Attachment path, and Audit History array
const proposalSchema = new mongoose.Schema({
    title: String, description: String, domain: String, budget: Number,
    submittedBy: String, status: { type: String, default: "Pending" },
    comment: { type: String, default: "" }, 
    attachment: { type: String, default: null },
    history: [{ status: String, comment: String, reviewedBy: String, date: { type: Date, default: Date.now } }]
}, { timestamps: true });

const Proposal = mongoose.model("Proposal", proposalSchema);
const User = mongoose.model("User", { email: String, password: String, role: String });

// Login API
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) res.json({ success: true, role: user.role });
    else res.json({ success: false });
});

// Submit Proposal API (Handles form data + PDF upload)
app.post("/proposals", upload.single("attachment"), async (req, res) => {
    try {
        const data = req.body;
        if (req.file) data.attachment = `/uploads/${req.file.filename}`;
        
        const proposal = new Proposal(data);
        proposal.history.push({ status: "Pending", comment: "Initial Submission", reviewedBy: data.submittedBy });
        
        await proposal.save();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Fetch Proposals API
app.get("/proposals", async (req, res) => {
    try { res.json(await Proposal.find().sort({ createdAt: -1 })); } 
    catch (err) { res.status(500).json({ error: "Server error" }); }
});

app.get("/proposals/:id", async (req, res) => {
    try { res.json(await Proposal.findById(req.params.id)); } 
    catch (err) { res.status(500).json({ error: "Server error" }); }
});

// Review Proposal API (Security & History Logging)
app.put("/proposals/:id", async (req, res) => {
    try {
        const { status, comment, role, email } = req.body;
        if (role !== "Reviewer" && role !== "Admin") return res.status(403).json({ success: false, message: "Unauthorized!" });
        
        const proposal = await Proposal.findById(req.params.id);
        proposal.status = status;
        proposal.comment = comment || "";
        proposal.history.push({ status, comment, reviewedBy: email });
        
        await proposal.save();
        res.json({ success: true });
    } catch (err) { res.json({ success: false }); }
});

// Live Polling Stats API
app.get("/proposals/stats/count", async (req, res) => {
    try {
        const count = await Proposal.countDocuments();
        const latest = await Proposal.findOne().sort({ updatedAt: -1 });
        res.json({ count, lastUpdate: latest ? latest.updatedAt : null });
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

// Admin Users API
app.get("/users", async (req, res) => {
    try { res.json(await User.find({}, "-password")); } 
    catch (err) { res.status(500).json({ error: "Server error" }); }
});

// Default Route
app.get("/", (req, res) => { res.redirect("/login.html"); });

app.listen(5000, () => console.log("Server running on port 5000"));