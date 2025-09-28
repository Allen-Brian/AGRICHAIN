// backend/hederaClient.js
import {
  Client,
  Hbar,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction
} from "@hashgraph/sdk";

import { HEDERA_CONFIG } from './config';

class HederaClient {
  constructor() {
    this.client = null;
    this.isConfigured = false;
    this.topicCache = new Map();
    this.initializeClient();
  }

  initializeClient() {
    try {
      if (!HEDERA_CONFIG.operatorId || !HEDERA_CONFIG.operatorKey ||
          HEDERA_CONFIG.operatorId.includes("YOUR_") || HEDERA_CONFIG.operatorKey.includes("YOUR_")) {
        console.warn("Hedera configuration missing. HCS operations will be skipped.");
        this.isConfigured = false;
        return;
      }

      this.client = Client.forName(HEDERA_CONFIG.network);
      this.client.setOperator(HEDERA_CONFIG.operatorId, PrivateKey.fromString(HEDERA_CONFIG.operatorKey));
      this.client.setDefaultMaxTransactionFee(new Hbar(2));
      this.isConfigured = true;
      console.log("Hedera client initialized successfully");
    } catch (err) {
      console.error("Failed to initialize Hedera client:", err);
      this.isConfigured = false;
    }
  }

  async _getOrCreateTopicForJob(job) {
    const key = String(job.job_id);
    if (this.topicCache.has(key)) return this.topicCache.get(key);

    const tx = await new TopicCreateTransaction()
      .setTopicMemo(`Transport Job ${job.job_id} - ${job.harvest_id}`)
      .execute(this.client);

    const rx = await tx.getReceipt(this.client);
    const topicId = rx.topicId ? rx.topicId.toString() : null;

    if (!topicId) throw new Error("Failed to create HCS topic");
    this.topicCache.set(key, topicId);
    return topicId;
  }

  // --- Pickup Logging ---
  async submitPickupLog(job, coords = { latitude: 0, longitude: 0 }) {
    if (!this.isConfigured || !this.client) return { success: false, message: "Hedera client not configured" };
    try {
      const topicId = await this._getOrCreateTopicForJob(job);
      const payload = {
        type: "PICKUP",
        job_id: job.job_id,
        harvest_id: job.harvest_id,
        transporter_id: job.transporter_id,
        pickup_timestamp: new Date().toISOString(),
        gps: coords,
        metadata: { app: "Transporter MVP", version: "1.0.0" }
      };
      const tx = await new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(JSON.stringify(payload))
        .execute(this.client);
      await tx.getReceipt(this.client);
      return { success: true, topicId, message: "Pickup logged on HCS" };
    } catch (err) {
      console.error("Pickup HCS error:", err);
      return { success: false, message: err.message || "HCS pickup failed" };
    }
  }

  // --- Delivery Logging ---
  async submitDeliveryReceipt(job, photoUri, coords = { latitude: 0, longitude: 0 }, receivedBy = "Unknown") {
    if (!this.isConfigured || !this.client) return { success: false, message: "Hedera client not configured" };
    try {
      const topicId = await this._getOrCreateTopicForJob(job);
      const receipt = {
        receipt_id: `${job.job_id}_${Date.now()}`,
        photo_url: photoUri || "",
        received_by: receivedBy,
        created_at: new Date().toISOString()
      };
      const gpsLogs = [coords]; // simple MVP: single point
      const messagePayload = {
        type: "DELIVERY_RECEIPT",
        job_id: job.job_id,
        harvest_id: job.harvest_id,
        transporter_id: job.transporter_id,
        receipt_id: receipt.receipt_id,
        photo_url_hash: this.generateHash(receipt.photo_url + job.job_id),
        received_by: receipt.received_by,
        delivery_timestamp: receipt.created_at,
        gps_points_count: gpsLogs.length,
        total_distance: this.calculateTotalDistance(gpsLogs),
        metadata: { app: "Transporter MVP", version: "1.0.0", timestamp: new Date().toISOString() }
      };
      const submitTx = await new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(JSON.stringify(messagePayload))
        .execute(this.client);
      await submitTx.getReceipt(this.client);
      return { success: true, topicId, message: "Delivery recorded on HCS" };
    } catch (error) {
      console.error("Delivery HCS error:", error);
      return { success: false, message: `HCS delivery failed: ${error?.message || error}` };
    }
  }

  generateHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  calculateTotalDistance(gpsLogs) {
    if (!Array.isArray(gpsLogs) || gpsLogs.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < gpsLogs.length; i++) total += this.calculateDistance(gpsLogs[i - 1], gpsLogs[i]);
    return parseFloat(total.toFixed(2));
  }

  calculateDistance(p1, p2) {
    const R = 6371;
    const dLat = this.toRad(p2.latitude - p1.latitude);
    const dLon = this.toRad(p2.longitude - p1.longitude);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(p1.latitude)) *
      Math.cos(this.toRad(p2.latitude)) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) { return deg * (Math.PI / 180); }
}

export const hederaClient = new HederaClient();
export default HederaClient;
