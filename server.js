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
    console.error("❌ Error fetching clients:", error);
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
    console.error("❌ Error adding client:", error);
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
    console.error("❌ Error fetching client:", error);
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
    console.error("❌ Error deleting client:", error);
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
      SELECT 
        invoices.id, invoices.invoice_number, invoices.amount, invoices.due_date, invoices.status, 
        invoices.client_id, invoices.item, invoices.date_created, clients.full_name,
        COALESCE((SELECT SUM(payments.amount) FROM payments WHERE payments.invoice_id = invoices.id), 0) AS total_paid
      FROM invoices 
      JOIN clients ON invoices.client_id = clients.id 
      ORDER BY due_date ASC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching invoices:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add a new invoice
// ✅ Add one or more invoices at once
app.post("/invoices", async (req, res) => {
  try {
    const invoices = req.body;

    // Ensure request is an array and has at least one invoice
    if (!Array.isArray(invoices) || invoices.length === 0 || invoices.length > 5) {
      return res.status(400).json({ error: "You can add between 1 to 5 invoices at a time." });
    }

    // Validate each invoice
    for (const invoice of invoices) {
      const { client_id, item, amount, due_date } = invoice;
      if (!client_id || !item || !amount || !due_date) {
        return res.status(400).json({ error: "Each invoice must have client_id, item, amount, and due_date." });
      }
    }

    // Prepare batch insert query
    const values = invoices.map(({ client_id, item, amount, due_date, status }) => {
      const invoice_number = `INV-${Math.floor(Math.random() * 90000) + 10000}`;
      return [client_id, invoice_number, item, amount, due_date, status || "Pending"];
    });

    const query = `
      INSERT INTO invoices (client_id, invoice_number, item, amount, due_date, status, date_created)
      VALUES ${values.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, CURRENT_TIMESTAMP)`).join(", ")}
      RETURNING *;
    `;

    const flatValues = values.flat();
    const result = await pool.query(query, flatValues);

    res.status(201).json(result.rows);
  } catch (error) {
    console.error("❌ Error adding invoices:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Update an Invoice (Edit Only Amount or Item)
app.put("/invoices/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let { amount, item } = req.body;

    console.log(`📝 Update request received for Invoice ID: ${id}`);

    // Check if invoice exists
    const checkInvoice = await pool.query("SELECT * FROM invoices WHERE id = $1", [id]);
    if (checkInvoice.rowCount === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Update only the allowed fields
    const updatedInvoice = await pool.query(
      `UPDATE invoices 
       SET amount = COALESCE($1, amount), 
           item = COALESCE($2, item) 
       WHERE id = $3 
       RETURNING *`,
      [amount, item, id]
    );

    res.json(updatedInvoice.rows[0]);

  } catch (error) {
    console.error("❌ Error updating invoice:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete an Invoice
app.delete("/invoices/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if invoice exists before deleting
    const checkInvoice = await pool.query("SELECT * FROM invoices WHERE id = $1", [id]);
    if (checkInvoice.rowCount === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Delete invoice
    await pool.query("DELETE FROM invoices WHERE id = $1", [id]);
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
// ✅ Fetch Payments (GET /payments)
// ✅ Fetch Payments (GET /payments)
app.get("/payments", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        payments.id, 
        clients.full_name AS client, 
        invoices.invoice_number, 
        payments.payment_date, 
        payments.mode, 
        payments.amount, 
        (invoices.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = invoices.id), 0)) AS balance_outstanding
      FROM payments
      JOIN invoices ON payments.invoice_id = invoices.id
      JOIN clients ON invoices.client_id = clients.id
      ORDER BY payments.payment_date DESC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching payments:", error.message);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// ✅ Fetch Invoices for a Specific Client (Only Unpaid Invoices)
app.get("/invoices", async (req, res) => {
  try {
    const { client_id } = req.query;

    if (!client_id) {
      return res.status(400).json({ error: "Client ID is required." });
    }

    const result = await pool.query(`
      SELECT id, invoice_number, amount, 
        (amount - COALESCE((SELECT SUM(amount) FROM payments WHERE payments.invoice_id = invoices.id), 0)) AS balance_outstanding
      FROM invoices
      WHERE client_id = $1
      HAVING (amount - COALESCE((SELECT SUM(amount) FROM payments WHERE payments.invoice_id = invoices.id), 0)) > 0
      ORDER BY due_date ASC;
    `, [client_id]);

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching invoices:", error.message);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// ✅ Add New Payment (POST /payments)
app.post("/payments", async (req, res) => {
  try {
    const payments = req.body;

    // Validate input
    if (!Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({ error: "At least one payment must be provided." });
    }

    for (const payment of payments) {
      const { invoice_id, mode, amount } = payment;
      if (!invoice_id || !mode || !amount) {
        return res.status(400).json({ error: "Invoice, mode of payment, and amount are required." });
      }

      // ✅ Check if invoice exists and belongs to a client
      const invoiceQuery = await pool.query(`
        SELECT client_id, amount, 
          (amount - COALESCE((SELECT SUM(amount) FROM payments WHERE payments.invoice_id = invoices.id), 0)) AS balance_outstanding
        FROM invoices WHERE id = $1
      `, [invoice_id]);

      if (invoiceQuery.rowCount === 0) {
        return res.status(400).json({ error: `Invoice ${invoice_id} does not exist.` });
      }

      const invoice = invoiceQuery.rows[0];

      // ✅ Prevent payments for fully paid invoices
      if (invoice.balance_outstanding <= 0) {
        return res.status(400).json({ error: `Invoice ${invoice_id} is already fully paid.` });
      }

      // ✅ Prevent overpayment
      if (amount > invoice.balance_outstanding) {
        return res.status(400).json({ error: `Payment exceeds outstanding balance for Invoice ${invoice_id}.` });
      }
    }

    // Insert multiple payments
    const values = payments.map(({ invoice_id, mode, amount }) => 
      [invoice_id, mode, amount]
    );

    const query = `
      INSERT INTO payments (invoice_id, mode, amount, payment_date, date_created)
      VALUES ${values.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, CURRENT_DATE, CURRENT_TIMESTAMP)`).join(", ")}
      RETURNING *;
    `;

    const flatValues = values.flat();
    const result = await pool.query(query, flatValues);

    res.status(201).json(result.rows);
  } catch (error) {
    console.error("❌ Error adding payment:", error.message);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// ✅ Delete a Payment (DELETE /payments/:id)
app.delete("/payments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if payment exists
    const checkPayment = await pool.query("SELECT * FROM payments WHERE id = $1", [id]);
    if (checkPayment.rowCount === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Delete payment
    await pool.query("DELETE FROM payments WHERE id = $1", [id]);
    res.json({ message: "Payment deleted successfully" });

  } catch (error) {
    console.error("❌ Error deleting payment:", error.message);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});


/* 
===========================================
 ✅ SERVER INITIALIZATION
===========================================
*/

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
