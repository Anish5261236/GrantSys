// Import required libraries
const express = require("express"); // Framework to create server and APIs
const mongoose = require("mongoose"); // Connect and work with MongoDB
const cors = require("cors"); // Allow frontend to talk to backend
const multer = require("multer"); // Handle file uploads
const fs = require("fs"); // File system (create folders, read files)
const path = require("path"); // Handle file paths

// Create Express app (main server)
const app = express();


// -------------------- MIDDLEWARE --------------------

// Enable CORS (important for frontend-backend communication)
app.use(cors());

// Allow server to read JSON data from requests
app.use(express.json());

// Serve static files (HTML, CSS, uploads)
app.use(express.static("public"));


// -------------------- FILE UPLOAD SETUP --------------------

// Define uploads folder path
const uploadDir = path.join(__dirname, "public", "uploads");

// If uploads folder doesn't exist → create it
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
    // Where to store files
    destination: (req, file, cb) => cb(null, uploadDir),

    // Rename file to avoid duplicates
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"));
    }
});

// Initialize multer
const upload = multer({ storage });


// -------------------- DATABASE CONNECTION --------------------

// Connect to MongoDB using environment variable
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log("MongoDB Error:", err));


// -------------------- SCHEMA DEFINITIONS --------------------

// Proposal schema (structure of proposal data)
const proposalSchema = new mongoose.Schema({
    title: String,
    description: String,
    domain: String,
    budget: Number,
    submittedBy: String,

    // Default status = Pending
    status: { type: String, default: "Pending" },

    comment: { type: String, default: "" },

    // File path of uploaded attachment
    attachment: { type: String, default: null },

    // History array to track changes
    history: [
        {
            status: String,
            comment: String,
            reviewedBy: String,
            date: { type: Date, default: Date.now }
        }
    ]

}, { timestamps: true }); // adds createdAt & updatedAt


// Create models (collections in MongoDB)
const Proposal = mongoose.model("Proposal", proposalSchema);

const User = mongoose.model("User", {
    email: String,
    password: String,
    role: String
});


// -------------------- LOGIN API --------------------

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists in database
        const user = await User.findOne({ email, password });

        if (user) {
            // Login success → send role
            res.json({ success: true, role: user.role });
        } else {
            // Login failed
            res.json({ success: false });
        }

    } catch (err) {
        res.status(500).json({ success: false });
    }
});


// -------------------- SUBMIT PROPOSAL --------------------

app.post("/proposals", upload.single("attachment"), async (req, res) => {
    try {
        const data = req.body;

        // If file uploaded → save path
        if (req.file) {
            data.attachment = `/uploads/${req.file.filename}`;
        }

        // Create new proposal
        const proposal = new Proposal(data);

        // Add initial history record
        proposal.history.push({
            status: "Pending",
            comment: "Initial Submission",
            reviewedBy: data.submittedBy
        });

        // Save to database
        await proposal.save();

        res.json({ success: true });

    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});


// -------------------- GET ALL PROPOSALS --------------------

app.get("/proposals", async (req, res) => {
    try {
        // Fetch all proposals (latest first)
        const proposals = await Proposal.find().sort({ createdAt: -1 });

        res.json(proposals);

    } catch {
        res.status(500).json({ error: "Server error" });
    }
});


// -------------------- GET SINGLE PROPOSAL --------------------

app.get("/proposals/:id", async (req, res) => {
    try {
        // Find proposal by ID
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

        // Only Reviewer or Admin can update
        if (role !== "Reviewer" && role !== "Admin") {
            return res.status(403).json({ success: false });
        }

        // Find proposal
        const proposal = await Proposal.findById(req.params.id);

        // Update status and comment
        proposal.status = status;
        proposal.comment = comment || "";

        // Add history record
        proposal.history.push({
            status,
            comment,
            reviewedBy: email
        });

        // Save changes
        await proposal.save();

        res.json({ success: true });

    } catch {
        res.json({ success: false });
    }
});


// -------------------- STATS API --------------------

app.get("/proposals/stats/count", async (req, res) => {
    try {
        // Count total proposals
        const count = await Proposal.countDocuments();

        // Get latest updated proposal
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
        // Get all users except passwords
        const users = await User.find({}, "-password");

        res.json(users);

    } catch {
        res.status(500).json({ error: "Server error" });
    }
});


// -------------------- DEFAULT ROUTE --------------------

// Redirect root URL to frontend page
app.get("/", (req, res) => {
    res.redirect("/index.html");
});


// -------------------- START SERVER --------------------

// Use dynamic port (important for deployment)
const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});