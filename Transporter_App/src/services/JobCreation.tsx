// src/services/jobCreation.ts
import { TransportJob } from '../types/models';
import { supabase } from './supabaseClient';

/**
 * Creates a new transport job in the database.
 * @param harvestId - ID from the scanned QR
 * @param transporterId - ID of the transporter performing the scan
 * @returns { success: boolean, data?: TransportJob, error?: string }
 */
export async function createJob(harvestId: string, transporterId: string) {
  try {
    if (!harvestId || !transporterId) {
      throw new Error('Missing harvestId or transporterId');
    }

    // Check if job already exists for this harvest
    const existingJob = await supabase
      .from('transport_jobs')
      .select('*')
      .eq('harvest_id', harvestId)
      .single();

    if (existingJob.data) {
      return { success: true, data: existingJob.data as TransportJob };
    }

    // Insert new job
    const { data, error } = await supabase
      .from('transport_jobs')
      .insert([
        {
          harvest_id: harvestId,
          transporter_id: transporterId,
          status: 'ACCEPTED', // default new job status
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: data as TransportJob };
  } catch (err: any) {
    console.error('createJob error:', err.message || err);
    return { success: false, error: err.message || 'Job creation failed' };
  }
}
