require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Render PostgreSQL
});

// Test route
app.get("/", (req, res) => {
  res.send("Backend is working! ✅");
});

// ✅ FIXED: Date Formatting Function
const formatDate = (date) => date.toISOString().split("T")[0];

// Fetch all receivables
app.get("/receivables", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM receivables ORDER BY due_date ASC;");
        const formattedData = result.rows.map(row => ({
            ...row,
            due_date: formatDate(row.due_date) // ✅ Properly formatted
        }));
        res.json(formattedData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
