// src/config.example.ts
// COPY this file to src/config.ts and replace placeholders with your real credentials.
// DO NOT commit src/config.ts to git with real keys.

export const SUPABASE_URL = "https://your-supabase-url.supabase.co";
export const SUPABASE_ANON_KEY = "your-supabase-anon-or-service-role-key";
export const SUPABASE_BUCKET = "receipts"; // create this bucket in Supabase Storage
export const HEDERA_NETWORK = "testnet"; // or "mainnet"
export const HEDERA_OPERATOR_ID = "0.0.xxxx"; // e.g. 0.0.12345
export const HEDERA_OPERATOR_KEY = "302e0201..."; // private key in hex format
export const APP_NAME = "Transporter App — built by DIRA";
export const APP_BRAND = "DIRA";
