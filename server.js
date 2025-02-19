require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors()); // ✅ Allow all origins for testing (Adjust for production)
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
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add a new client
app.post("/clients", async (req, res) => {
  try {
    const { full_name, address, contact } = req.body;
    if (!full_name || !address || !contact) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const result = await pool.query(
      "INSERT INTO clients (full_name, address, contact) VALUES ($1, $2, $3) RETURNING *",
      [full_name, address, contact]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding client:", error);
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
    console.error("Error fetching client:", error);
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
    console.error("Error deleting client:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* 
===========================================
 ✅ INVOICES ENDPOINTS
===========================================
*/

// Get all invoices (Now includes the client name directly in the response)
app.get("/invoices", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT invoices.id, invoices.invoice_number, invoices.amount, invoices.due_date, invoices.status, 
             invoices.client_id, clients.full_name 
      FROM invoices 
      JOIN clients ON invoices.client_id = clients.id 
      ORDER BY due_date ASC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add a new invoice
app.post("/invoices", async (req, res) => {
  try {
    const { client_id, amount, due_date, status } = req.body;
    if (!client_id || !amount || !due_date) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Generate a unique invoice number (Auto-increment logic)
    const invoiceNumberResult = await pool.query(`
      SELECT COUNT(*) + 1 AS next_invoice_number FROM invoices;
    `);
    const invoice_number = `INV-${String(invoiceNumberResult.rows[0].next_invoice_number).padStart(4, "0")}`;

    const result = await pool.query(
      "INSERT INTO invoices (client_id, invoice_number, amount, due_date, status) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [client_id, invoice_number, amount, due_date, status || "Pending"]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding invoice:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete an Invoice
// DELETE an Invoice
app.delete("/invoices/:id", async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑 Received DELETE request for invoice ID: ${id}`); // ✅ Debugging

    // Check if invoice exists before deleting
    const checkInvoice = await pool.query("SELECT * FROM invoices WHERE id = $1", [id]);
    if (checkInvoice.rowCount === 0) {
      console.log(`🚨 Invoice ID: ${id} not found in database`);
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Delete invoice
    await pool.query("DELETE FROM invoices WHERE id = $1", [id]);
    console.log(`✅ Invoice ID: ${id} deleted successfully`);
    res.json({ message: "Invoice deleted successfully" });

  } catch (error) {
    console.error("❌ Error deleting invoice:", error);
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
    const result = await pool.query(
      "SELECT payments.*, clients.full_name FROM payments JOIN clients ON payments.client_id = clients.id ORDER BY payment_date DESC;"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add a payment
app.post("/payments", async (req, res) => {
  try {
    const { client_id, amount, payment_date, method } = req.body;
    if (!client_id || !amount || !payment_date || !method) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const result = await pool.query(
      "INSERT INTO payments (client_id, amount, payment_date, method) VALUES ($1, $2, $3, $4) RETURNING *",
      [client_id, amount, payment_date, method]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete a payment
app.delete("/payments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM payments WHERE id = $1", [id]);
    res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment:", error);
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
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get settings
app.get("/settings", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM settings;");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
