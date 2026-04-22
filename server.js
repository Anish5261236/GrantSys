const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) =>
        cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"))
});
const upload = multer({ storage });

// ✅ MongoDB connection (Render + Atlas)
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log("MongoDB Error:", err));

// Schema
const proposalSchema = new mongoose.Schema({
    title: String,
    description: String,
    domain: String,
    budget: Number,
    submittedBy: String,
    status: { type: String, default: "Pending" },
    comment: { type: String, default: "" },
    attachment: { type: String, default: null },
    history: [
        {
            status: String,
            comment: String,
            reviewedBy: String,
            date: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true });

const Proposal = mongoose.model("Proposal", proposalSchema);
const User = mongoose.model("User", {
    email: String,
    password: String,
    role: String
});

// Login API
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });

        if (user) {
            res.json({ success: true, role: user.role });
        } else {
            res.json({ success: false });
        }
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Submit Proposal
app.post("/proposals", upload.single("attachment"), async (req, res) => {
    try {
        const data = req.body;

        if (req.file) {
            data.attachment = `/uploads/${req.file.filename}`;
        }

        const proposal = new Proposal(data);
        proposal.history.push({
            status: "Pending",
            comment: "Initial Submission",
            reviewedBy: data.submittedBy
        });

        await proposal.save();
        res.json({ success: true });

    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Get all proposals
app.get("/proposals", async (req, res) => {
    try {
        const proposals = await Proposal.find().sort({ createdAt: -1 });
        res.json(proposals);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

// Get single proposal
app.get("/proposals/:id", async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id);
        res.json(proposal);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

// Review proposal
app.put("/proposals/:id", async (req, res) => {
    try {
        const { status, comment, role, email } = req.body;

        if (role !== "Reviewer" && role !== "Admin") {
            return res.status(403).json({ success: false });
        }

        const proposal = await Proposal.findById(req.params.id);

        proposal.status = status;
        proposal.comment = comment || "";

        proposal.history.push({
            status,
            comment,
            reviewedBy: email
        });

        await proposal.save();
        res.json({ success: true });

    } catch {
        res.json({ success: false });
    }
});

// Stats API
app.get("/proposals/stats/count", async (req, res) => {
    try {
        const count = await Proposal.countDocuments();
        const latest = await Proposal.findOne().sort({ updatedAt: -1 });

        res.json({
            count,
            lastUpdate: latest ? latest.updatedAt : null
        });

    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

// Users API
app.get("/users", async (req, res) => {
    try {
        const users = await User.find({}, "-password");
        res.json(users);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

// Default route
app.get("/", (req, res) => {
    res.redirect("/index.html");
});

// ✅ IMPORTANT: Dynamic PORT for Render
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));