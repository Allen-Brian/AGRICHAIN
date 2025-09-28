// USER: Copy from config.example.ts and fill in your actual values below
// WARNING: Never commit this file with real keys to version control

// Supabase Configuration
export const SUPABASE_CONFIG = {
  url: 'https://gmzuozfznzxztcwgdwlq.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtenVvemZ6bnp4enRjd2dkd2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMjk0NTksImV4cCI6MjA3MzcwNTQ1OX0.z2BfTfOvBIS9YDsHiFF6rviLBnS10rAUnPMv3dFPzLY',
  serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtenVvemZ6bnp4enRjd2dkd2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODEyOTQ1OSwiZXhwIjoyMDczNzA1NDU5fQ.O8Hppy5gqqwy4k6GvWHx6h26lBGJPtn2qfEf9ymoyr4',
  receiptsBucket: 'receipts',
};

// Hedera Configuration
export const HEDERA_CONFIG = {
  operatorId: 'YOUR_HEDERA_OPERATOR_ID_HERE',
  operatorKey: 'YOUR_HEDERA_OPERATOR_KEY_HERE',
  network: 'testnet' as 'testnet' | 'mainnet',
};

// App Configuration
export const APP_CONFIG = {
  name: 'Transporter App',
  brand: 'DIRA',
  gpsTrackingInterval: 15000,
  qrCodeTypes: ['org.iso.QRCode'] as const,
};

export const IS_DEV = __DEV__;