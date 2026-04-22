# GrantSys - Secure Research Management Portal

## 📖 Project Overview
GrantSys is a full-stack web application designed to streamline the submission, tracking, and review process for academic research proposals. It provides a secure, role-based dashboard for faculty members, reviewers, and administrators to manage grant applications efficiently. The system features a modern, responsive Glassmorphism UI with real-time analytics, file upload capabilities, and a robust audit log.

**Developed by:** Anish Karthik  
**Institution:** Lovely Professional University (LPU)

---

## 🚀 Tech Stack
* **Frontend:** HTML5, CSS3 (Custom Properties, CSS Animations), Vanilla JavaScript (ES6+).
* **Data Visualization:** Chart.js (Interactive dashboards and analytical charts).
* **Backend:** Node.js, Express.js.
* **Database:** MongoDB (Mongoose ODM).
* **File Handling:** Multer (for secure PDF document uploads).
* **Styling:** Custom Glassmorphism UI, Dark/Light theme toggling.

---

## ✨ Core Features & Role-Based Access

The system operates on a strict Role-Based Access Control (RBAC) model:

### 1. Faculty (Submitters)
* **Secure Authentication:** Login via academic email.
* **Proposal Submission:** Form interface to submit project titles, domains, budgets, and executive summaries.
* **Document Uploads:** Drag-and-drop interface for attaching PDF supporting documents.
* **Real-time Tracking:** Dashboard to track the live status (Pending, Approved, Rejected) of their submissions.

### 2. Reviewer (Evaluation Committee)
* **Review Queue:** Dedicated dashboard to view all pending proposals.
* **Proposal Inspection:** Access to detailed proposal data and attached PDF documents.
* **Approval Workflow:** Ability to approve or reject grants while providing mandatory actionable feedback.

### 3. Administrator (System Oversight)
* **Global Dashboard:** View all proposals across the system regardless of status.
* **User Management:** Registry to monitor active users and their system roles.
* **Platform Analytics:** Visual charts (Bar, Line, Doughnut) tracking approval trends, monthly submissions, and domain distributions.
* **Audit Logging:** Tracks every status change, who authorized it, and the exact timestamp.

---

## 📁 Folder Structure & Architecture

To run this project correctly, your files must be organized in the following structure:

```text
GrantSys/
│
├── server.js                 # Main Express.js backend server and API routes
├── package.json              # Node.js dependencies
│
└── public/                   # Static frontend assets served by Express
    ├── login.html            # Authentication interface
    ├── dashboard.html        # Main role-based workspace and analytics
    ├── submit.html           # Proposal submission form
    ├── review.html           # Proposal evaluation and audit interface
    │
    └── uploads/              # Directory generated automatically for PDF storage