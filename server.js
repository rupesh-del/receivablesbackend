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

// ✅ Test API
app.get("/", (req, res) => {
  res.send("Backend is working! ✅");
});

/* 
===========================================
 ✅ CLIENTS ENDPOINTS
===========================================
*/

// Get all clients
app.get("/clients", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients ORDER BY id ASC;");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add a new client
app.post("/clients", async (req, res) => {
  try {
    const { full_name, address, contact } = req.body;
    const result = await pool.query(
      "INSERT INTO clients (full_name, address, contact) VALUES ($1, $2, $3) RETURNING *",
      [full_name, address, contact]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get a single client by ID
app.get("/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM clients WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Client not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete a client
app.delete("/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM clients WHERE id = $1", [id]);
    res.json({ message: "Client deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* 
===========================================
 ✅ INVOICES ENDPOINTS
===========================================
*/

// Get all invoices
app.get("/invoices", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM invoices ORDER BY due_date ASC;");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add a new invoice
app.post("/invoices", async (req, res) => {
  try {
    const { client_id, amount, due_date, status } = req.body;
    const result = await pool.query(
      "INSERT INTO invoices (client_id, amount, due_date, status) VALUES ($1, $2, $3, $4) RETURNING *",
      [client_id, amount, due_date, status || "Pending"]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* 
===========================================
 ✅ PAYMENTS ENDPOINTS
===========================================
*/

// Get all payments
app.get("/payments", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM payments ORDER BY payment_date DESC;");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add a payment
app.post("/payments", async (req, res) => {
  try {
    const { client_id, amount, payment_date, method } = req.body;
    const result = await pool.query(
      "INSERT INTO payments (client_id, amount, payment_date, method) VALUES ($1, $2, $3, $4) RETURNING *",
      [client_id, amount, payment_date, method]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* 
===========================================
 ✅ REPORTS & SETTINGS (Optional)
===========================================
*/

// Get all reports
app.get("/reports", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM reports ORDER BY generated_at DESC;");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get settings
app.get("/settings", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM settings;");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
