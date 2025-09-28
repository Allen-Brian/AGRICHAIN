// src/services/jobActions.ts
import axios from "axios";
import { GPSLog, TransportJob } from "../types/models";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://172.20.10.12:3000/api";

/**
 * Normalize GPS logs: ensure all required fields exist and are non-null
 */
function normalizeGPSLogs(jobId: string, transporterId: string, gpsLogs: Partial<GPSLog>[] = []): GPSLog[] {
  const now = new Date().toISOString();

  if (!gpsLogs || gpsLogs.length === 0) {
    return [
      {
        log_id: `gps-${Date.now()}`,
        job_id: jobId,
        transporter_id: transporterId,
        latitude: 0,
        longitude: 0,
        altitude: 0,
        speed: 0,
        accuracy: 0,
        timestamp: now,
        created_at: now,
      },
    ];
  }

  return gpsLogs.map((g) => ({
    log_id: g.log_id || `gps-${Date.now()}`,
    job_id: g.job_id || jobId,
    transporter_id: g.transporter_id || transporterId,
    latitude: g.latitude ?? 0,
    longitude: g.longitude ?? 0,
    altitude: g.altitude ?? 0,
    speed: g.speed ?? 0,
    accuracy: g.accuracy ?? 0,
    timestamp: g.timestamp ?? now,
    created_at: g.created_at ?? now,
  }));
}

/**
 * Submit a pickup action to backend/Hedera
 */
export async function markPickup(job: TransportJob, gpsLogs: Partial<GPSLog>[] = []) {
  try {
    const receipt = {
      receipt_id: `pickup-${Date.now()}`,
      created_at: new Date().toISOString(),
      received_by: "transporter",
      photo_url: "", // always a string
    };

    const res = await axios.post(`${API_BASE_URL}/submitReceipt`, {
      job,
      receipt,
      gpsLogs: normalizeGPSLogs(job.job_id, job.transporter_id, gpsLogs),
    });

    return res.data;
  } catch (error: any) {
    console.error("markPickup error:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.message || "Pickup failed",
    };
  }
}

/**
 * Submit a delivery action to backend/Hedera
 */
export async function markDelivery(
  job: TransportJob,
  receiptUrl: string | null,
  gpsLogs: Partial<GPSLog>[] = []
) {
  try {
    const safeReceiptUrl = receiptUrl ?? ""; // ✅ always string
    const receipt = {
      receipt_id: `delivery-${Date.now()}`,
      created_at: new Date().toISOString(),
      received_by: "customer",
      photo_url: safeReceiptUrl,
    };

    const res = await axios.post(`${API_BASE_URL}/submitReceipt`, {
      job,
      receipt,
      gpsLogs: normalizeGPSLogs(job.job_id, job.transporter_id, gpsLogs),
    });

    return res.data;
  } catch (error: any) {
    console.error("markDelivery error:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.message || "Delivery failed",
    };
  }
}

/**
 * Submit a delivery receipt manually (optional, from ReceiptUploadScreen)
 */
export async function submitReceipt(
  job: TransportJob,
  receipt: { receipt_id: string; created_at: string; received_by: string; photo_url: string | null },
  gpsLogs: Partial<GPSLog>[] = []
) {
  try {
    const safeReceipt = {
      ...receipt,
      photo_url: receipt.photo_url ?? "", // ✅ ensure string
    };

    const res = await axios.post(`${API_BASE_URL}/submitReceipt`, {
      job,
      receipt: safeReceipt,
      gpsLogs: normalizeGPSLogs(job.job_id, job.transporter_id, gpsLogs),
    });

    return res.data;
  } catch (error: any) {
    console.error("submitReceipt error:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.message || "Receipt submission failed",
    };
  }
}
