// Import required libraries
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Create Express app (main server)
const app = express();

// -------------------- MIDDLEWARE --------------------
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Ensure uploads directory exists safely
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// -------------------- MULTER CONFIG --------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"))
});

// SAFER FILTER: Check the actual file extension instead of the MIME type
const fileFilter = (req, file, cb) => {
    // Get the extension and make it lowercase (e.g., '.PPTX' becomes '.pptx')
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.pdf', '.ppt', '.pptx'];

    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type (${ext}). Only PDF, PPT, and PPTX are allowed.`), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// -------------------- DATABASE CONNECTION --------------------
// Fallback URI is provided for local testing without an environment variable
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/grantsys") 
.then(async () => {
    console.log("MongoDB Connected");
    await initializeData(); // Generate initial data for users and proposals
})
.catch(err => console.log("MongoDB Error:", err));

// -------------------- SCHEMA DEFINITIONS --------------------
const proposalSchema = new mongoose.Schema({
    title: String,
    description: String,
    domain: String,
    budget: Number,
    deadline: Date, 
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

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['Faculty', 'Reviewer', 'Admin'] }
});

const User = mongoose.model("User", userSchema);

// -------------------- DATA INITIALIZATION --------------------
async function initializeData() {
    try {
        const userCount = await User.countDocuments();
        if (userCount === 0) {
            console.log("Generating initial user data...");
            await User.create([
                { email: 'admin@grantsys.edu', password: '123', role: 'Admin' },
                { email: 'faculty@grantsys.edu', password: '123', role: 'Faculty' },
                { email: 'reviewer@grantsys.edu', password: '123', role: 'Reviewer' }
            ]);
        }

        const proposalCount = await Proposal.countDocuments();
        if (proposalCount === 0) {
            console.log("Generating initial proposal data...");
            const deadlines = [
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
                new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
                new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago (expired)
            ];
            await Proposal.create([
                { title: 'Quantum Computing Fundamentals', description: 'Basic research on qubit stability.', domain: 'Physics', budget: 15000, deadline: deadlines[0], submittedBy: 'faculty@grantsys.edu', status: 'Approved' },
                { title: 'AI in Smart Agriculture', description: 'Improving crop yield using machine learning.', domain: 'Agriculture', budget: 25000, deadline: deadlines[1], submittedBy: 'faculty@grantsys.edu', status: 'Pending' },
                { title: 'Sustainable Polymer Research', description: 'Developing biodegradable plastic alternatives.', domain: 'Chemistry', budget: 10000, deadline: deadlines[2], submittedBy: 'faculty@grantsys.edu', status: 'Rejected', comment: 'Proposed deadline is already in the past. Please revise and resubmit with a valid timeline.' }
            ]);
        }
        console.log("Data initialization complete.");
    } catch (err) {
        console.error("Error initializing data:", err);
    }
}

// -------------------- LOGIN API --------------------
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

// -------------------- SUBMIT PROPOSAL --------------------
app.post("/proposals", (req, res) => {
    // Run the upload function INSIDE the route to catch Multer errors properly
    upload.single("attachment")(req, res, async (err) => {
        if (err) {
            // If the file is too large or the wrong extension, send the error to the frontend
            return res.json({ success: false, error: err.message });
        }

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
        } catch (dbErr) {
            res.json({ success: false, error: dbErr.message });
        }
    });
});

// -------------------- GET ALL PROPOSALS --------------------
app.get("/proposals", async (req, res) => {
    try {
        const proposals = await Proposal.find().sort({ createdAt: -1 });
        res.json(proposals);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

// -------------------- GET SINGLE PROPOSAL --------------------
app.get("/proposals/:id", async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id);
        res.json(proposal);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

// -------------------- REVIEW PROPOSAL --------------------
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

// -------------------- STATS API --------------------
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

// -------------------- USERS API --------------------
app.get("/users", async (req, res) => {
    try {
        const users = await User.find({}, "-password");
        res.json(users);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

// Route to create a new user (Admin only)
app.post("/users", async (req, res) => {
    try {
        const { email, password, role } = req.body;
        await User.create({ email, password, role });
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Route to delete a user by ID (Admin only)
app.delete("/users/:id", async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// -------------------- DEFAULT ROUTE --------------------
app.get("/", (req, res) => {
    res.redirect("/index.html");
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`); 
});