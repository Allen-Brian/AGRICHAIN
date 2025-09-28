// backend/server.js
import cors from "cors";
import express from "express";
import { hederaClient } from "./hederaClient.js"; // ✅ backend-only import

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*" })); 
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mark pickup
app.post("/api/jobs/:jobId/pickup", async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = { job_id: jobId, harvest_id: "HARVEST123", transporter_id: "TX01" }; 
    // 🔑 Replace with Supabase fetch

    const receipt = {
      receipt_id: `pickup-${Date.now()}`,
      received_by: "Pickup Agent",
      created_at: new Date().toISOString(),
      photo_url: ""
    };

    const result = await hederaClient.submitDeliveryReceipt(job, receipt, []);
    return res.status(result.success ? 200 : 502).json(result);
  } catch (err) {
    console.error("Pickup error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Mark delivery
app.post("/api/jobs/:jobId/delivery", async (req, res) => {
  const { jobId } = req.params;
  const { receiptUrl } = req.body;

  try {
    const job = { job_id: jobId, harvest_id: "HARVEST123", transporter_id: "TX01" }; 
    // 🔑 Replace with Supabase fetch

    const receipt = {
      receipt_id: `delivery-${Date.now()}`,
      received_by: "Delivery Agent",
      created_at: new Date().toISOString(),
      photo_url: receiptUrl
    };

    const result = await hederaClient.submitDeliveryReceipt(job, receipt, []);
    return res.status(result.success ? 200 : 502).json(result);
  } catch (err) {
    console.error("Delivery error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Submit delivery receipt (generic — keep for flexibility)
app.post("/api/submitReceipt", async (req, res) => {
  const { job, receipt, gpsLogs } = req.body;

  if (!job?.job_id || !receipt?.receipt_id) {
    return res.status(400).json({ success: false, error: "job_id and receipt_id are required" });
  }

  try {
    const result = await hederaClient.submitDeliveryReceipt(job, receipt, gpsLogs || []);
    return res.status(result.success ? 200 : 502).json(result);
  } catch (err) {
    console.error("Unhandled error in /api/submitReceipt:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Global error handling
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// Start server
app.listen(PORT, () => {
  console.log(`Transporter MVP backend listening on port ${PORT}`);
});
