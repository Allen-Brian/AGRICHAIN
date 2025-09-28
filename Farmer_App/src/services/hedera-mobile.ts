// hedera-mobile.ts
// Mobile-friendly Hedera helpers — CLIENT SIDE ONLY
// IMPORTANT: This file does NOT hold private keys. Hedera private keys belong on the server.

import { sha256 } from 'js-sha256';
import { decode as atob } from 'base-64';

/**
 * ENV VARIABLES (Expo)
 * - EXPO_PUBLIC_API_URL: URL to your backend (e.g. https://api.example.com)
 * - EXPO_PUBLIC_HEDERA_ACCOUNT_ID: public Hedera account id (0.0.x) — OK to be public
 * - EXPO_PUBLIC_CLIENT_KEY (optional): an app-level key you might send to backend (NOT service_role)
 *
 * Put these in your Expo .env or app config (but never private keys).
 */
const HEDERA_ACCOUNT_ID = process.env.EXPO_PUBLIC_HEDERA_ACCOUNT_ID || null;
const EXPO_API_URL = process.env.EXPO_PUBLIC_API_URL || '';
const EXPO_CLIENT_KEY = process.env.EXPO_PUBLIC_CLIENT_KEY || ''; // optional short token

// Mirror node endpoint (read-only, safe to call from client)
const HEDERA_TESTNET_API = 'https://testnet.mirrornode.hedera.com/api/v1';

type Maybe<T> = T | null;

/* ----------------------
   Types
   ---------------------- */
export interface HarvestRecord {
  id: string;
  hash: string;
  data: object;
  timestamp: string;
  accountId: string | null;
}

export interface BackendPayload {
  hash: string;
  data: object;
  // signature intentionally omitted on client (server will authoritatively sign/submit)
  accountId: string | null;
  timestamp: string;
}

export interface AccountInfo {
  accountId: string | null;
  balance: string;
  isValid: boolean;
  error?: string;
}

export interface CredentialCheck {
  isValid: boolean;
  error?: string;
}

/* ----------------------
   Debug (safe)
   ---------------------- */
// Log only public info — do NOT log secrets
console.log('HEDERA (client) ACCOUNT ID:', HEDERA_ACCOUNT_ID ? HEDERA_ACCOUNT_ID : 'none');
console.log('EXPO_API_URL detected:', EXPO_API_URL ? EXPO_API_URL : 'none');

/* ----------------------
   Helpers
   ---------------------- */

/**
 * Check credentials: client only needs to know if it has a public account id and backend URL
 */
export function checkHederaCredentials(): CredentialCheck {
  if (!EXPO_API_URL) {
    return {
      isValid: false,
      error: 'Missing EXPO_PUBLIC_API_URL. Set the backend URL in Expo env.'
    };
  }

  if (!HEDERA_ACCOUNT_ID) {
    return {
      isValid: false,
      error: 'Missing EXPO_PUBLIC_HEDERA_ACCOUNT_ID. This is the public Hedera account id.'
    };
  }

  return { isValid: true };
}

/**
 * Create deterministic JSON string for hashing (sorted keys)
 */
function canonicalize(obj: object): string {
  // Simple stable stringify for common objects
  const allKeys = Object.keys(obj).sort();
  const canonical: any = {};
  for (const k of allKeys) {
    const v = (obj as any)[k];
    // If nested object, JSON.stringify it stably as well (simple recursive)
    canonical[k] = typeof v === 'object' && v !== null ? JSON.parse(canonicalize(v)) : v;
  }
  return JSON.stringify(canonical);
}

/* ----------------------
   Hash + record functions
   ---------------------- */

/**
 * Hash harvest data for integrity verification (client-side proof)
 */
export function hashHarvestData(harvestData: object): string {
  try {
    const dataString = canonicalize(harvestData);
    return sha256(dataString);
  } catch (err) {
    // fallback to simple stringify if anything unexpected
    return sha256(JSON.stringify(harvestData));
  }
}

/**
 * Create a harvest record locally. This is the "proof" object the client can store offline.
 */
export function createHarvestRecord(harvestData: object): HarvestRecord {
  const hash = hashHarvestData(harvestData);
  const record: HarvestRecord = {
    id: `harvest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    hash,
    data: harvestData,
    timestamp: new Date().toISOString(),
    accountId: HEDERA_ACCOUNT_ID || null
  };
  return record;
}

/**
 * Verify local data against stored hash
 */
export function verifyHarvestData(originalData: object, storedHash: string): boolean {
  const currentHash = hashHarvestData(originalData);
  return currentHash === storedHash;
}

/* ----------------------
   Mirror node read-only helpers
   ---------------------- */

/**
 * Get account info from Hedera mirror node (read-only)
 */
export async function getAccountInfo(): Promise<AccountInfo> {
  try {
    if (!HEDERA_ACCOUNT_ID) {
      throw new Error('No account ID configured on client');
    }
    const resp = await fetch(`${HEDERA_TESTNET_API}/accounts/${HEDERA_ACCOUNT_ID}`);
    if (!resp.ok) {
      throw new Error(`Account not found or invalid: ${resp.status}`);
    }
    const accountData = await resp.json();
    return {
      accountId: HEDERA_ACCOUNT_ID,
      balance: accountData.balance?.balance?.toString?.() || '0',
      isValid: true
    };
  } catch (error: any) {
    return {
      accountId: HEDERA_ACCOUNT_ID || null,
      balance: '0',
      isValid: false,
      error: error?.message || String(error)
    };
  }
}

/**
 * Fetch topic messages from mirror node and decode base64 safely for RN/browser.
 */
export async function getTopicMessages(topicId: string, limit: number = 10): Promise<{ messages: any[]; error?: string }> {
  try {
    const resp = await fetch(`${HEDERA_TESTNET_API}/topics/${topicId}/messages?limit=${limit}&order=desc`);
    if (!resp.ok) throw new Error(`Failed to fetch messages: ${resp.status}`);
    const data = await resp.json();
    const msgs = (data.messages || []).map((m: any) => {
      // message may be base64-encoded string
      let decoded = null;
      try {
        if (typeof Buffer !== 'undefined' && Buffer.from) {
          decoded = Buffer.from(m.message, 'base64').toString('utf8');
        } else {
          // fallback to atob (base-64 package)
          decoded = atob(m.message);
        }
      } catch (e) {
        decoded = null;
      }
      return { ...m, decoded_message: decoded };
    });
    return { messages: msgs };
  } catch (error: any) {
    return { messages: [], error: error?.message || String(error) };
  }
}

/* ----------------------
   Backend submission
   ---------------------- */

/**
 * Prepare a payload for backend submission.
 * NOTE: client does NOT sign with private key. Backend computes authoritative hash/signature & submits to Hedera.
 *
 * Returns object suitable to send to your backend /api/hedera/submit-harvest.
 */
export function prepareForBackendSubmission(harvestData: object): BackendPayload {
  const hash = hashHarvestData(harvestData);
  const timestamp = new Date().toISOString();

  return {
    hash,
    data: harvestData,
    accountId: HEDERA_ACCOUNT_ID || null,
    timestamp
  };
}

/**
 * Submit to backend server which will do authoritative hashing/signing and HCS submission.
 *
 * - backendUrl: full backend base URL (if omitted, uses EXPO_PUBLIC_API_URL env)
 * - payload: BackendPayload produced by prepareForBackendSubmission
 * - apiKey: optional API key header value (if your backend requires x-api-key). Do NOT pass service_role keys here.
 */
export async function submitToBackendServer(
  backendUrl: string | null,
  payload: BackendPayload,
  apiKey: string | null = EXPO_CLIENT_KEY || null
): Promise<{ success: boolean; harvestId?: string; transactionId?: string; qrDataUrl?: string; error?: string }> {
  const url = (backendUrl || EXPO_API_URL || '').replace(/\/+$/, '');
  if (!url) {
    return { success: false, error: 'No backend URL provided' };
  }

  try {
    const resp = await fetch(`${url}/api/hedera/submit-harvest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {})
      },
      body: JSON.stringify({ data: payload.data, /* note: server will compute canonical hash */ })
    });

    const result = await resp.json();
    if (!resp.ok) {
      return { success: false, error: result?.error || `Server returned ${resp.status}` };
    }

    return {
      success: true,
      harvestId: result.harvestId || result.id || undefined,
      transactionId: result.hederaTxId || result.transactionId || undefined,
      qrDataUrl: result.qrDataUrl || undefined
    };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}

/* ----------------------
   Utilities exported
   ---------------------- */

export {
  HEDERA_ACCOUNT_ID,
  EXPO_API_URL,
  EXPO_CLIENT_KEY
};

export type { BackendPayload as _BackendPayload }; // exported only as type alias for clarity
