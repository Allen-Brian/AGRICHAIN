import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { SUPABASE_CONFIG } from '../../config';
import { ApiResponse, DeliveryReceipt, GPSLog, Transporter, TransporterRegistrationForm, TransportJob } from '../types/models';

// Create Supabase client
export const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey,
  {
    auth: {
      storage: SecureStore,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Storage keys
const TRANSPORTER_STORAGE_KEY = 'transporter_data';

// Transporter Management
export const storeTransporter = async (transporter: Transporter): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TRANSPORTER_STORAGE_KEY, JSON.stringify(transporter));
  } catch (error) {
    console.error('Error storing transporter:', error);
    throw new Error('Failed to store transporter data');
  }
};

export const retrieveTransporter = async (): Promise<Transporter | null> => {
  try {
    const stored = await SecureStore.getItemAsync(TRANSPORTER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error retrieving transporter:', error);
    return null;
  }
};

export const clearTransporter = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(TRANSPORTER_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing transporter:', error);
    throw new Error('Failed to clear transporter data');
  }
};

// Transporter Operations
export const registerTransporter = async (formData: TransporterRegistrationForm): Promise<ApiResponse<Transporter>> => {
  try {
    const { data, error } = await supabase
      .from('transporters')
      .insert([formData])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null, success: true };
  } catch (error: any) {
    console.error('Error registering transporter:', error);
    return { data: null, error: error.message, success: false };
  }
};

export const getTransportJobs = async (transporterId: string | null): Promise<ApiResponse<TransportJob[]>> => {
  try {
    let query = supabase
      .from('transport_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (transporterId) {
      query = query.or(`transporter_id.eq.${transporterId},status.eq.PENDING`);
    } else {
      query = query.eq('status', 'PENDING');
    }

    const { data, error } = await query;

    if (error) throw error;
    return { data, error: null, success: true };
  } catch (error: any) {
    console.error('Error fetching transport jobs:', error);
    return { data: null, error: error.message, success: false };
  }
};

export const acceptJob = async (jobId: string, transporterId: string): Promise<ApiResponse<TransportJob>> => {
  try {
    const { data, error } = await supabase
      .from('transport_jobs')
      .update({ 
        transporter_id: transporterId, 
        status: 'ACCEPTED',
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null, success: true };
  } catch (error: any) {
    console.error('Error accepting job:', error);
    return { data: null, error: error.message, success: false };
  }
};

export const handleQRScan = async (harvestUuid: string, transporterUuid: string): Promise<ApiResponse<{ job_id: string }>> => {
  try {
    const { data, error } = await supabase
      .rpc('handle_qr_scan', {
        harvest_uuid: harvestUuid,
        transporter_uuid: transporterUuid
      });

    if (error) throw error;
    return { data: { job_id: data }, error: null, success: true };
  } catch (error: any) {
    console.error('Error handling QR scan:', error);
    return { data: null, error: error.message, success: false };
  }
};

export const insertGPSLog = async (gpsData: Omit<GPSLog, 'log_id' | 'created_at'>): Promise<ApiResponse<GPSLog>> => {
  try {
    const { data, error } = await supabase
      .from('transport_gps_logs')
      .insert([gpsData])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null, success: true };
  } catch (error: any) {
    console.error('Error inserting GPS log:', error);
    return { data: null, error: error.message, success: false };
  }
};

export const uploadReceiptPhoto = async (jobId: string, imageUri: string): Promise<ApiResponse<string>> => {
  try {
    const fileName = `${jobId}_${Date.now()}.jpg`;
    const formData = new FormData();
    
    // @ts-ignore
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: fileName,
    });

    const { data, error } = await supabase.storage
      .from(SUPABASE_CONFIG.receiptsBucket)
      .upload(fileName, formData, {
        contentType: 'image/jpeg',
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(SUPABASE_CONFIG.receiptsBucket)
      .getPublicUrl(fileName);

    return { data: publicUrl, error: null, success: true };
  } catch (error: any) {
    console.error('Error uploading receipt photo:', error);
    return { data: null, error: error.message, success: false };
  }
};

export const createDeliveryReceipt = async (
  receiptData: Omit<DeliveryReceipt, 'receipt_id' | 'created_at'>
): Promise<ApiResponse<DeliveryReceipt>> => {
  try {
    const { data, error } = await supabase
      .from('delivery_receipts')
      .insert([receiptData])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null, success: true };
  } catch (error: any) {
    console.error('Error creating delivery receipt:', error);
    return { data: null, error: error.message, success: false };
  }
};