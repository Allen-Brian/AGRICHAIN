import * as Location from 'expo-location';
import { APP_CONFIG } from '../../config';
import { GPSLog } from '../types/models';
import { insertGPSLog } from './supabaseClient';

export class GPSTracker {
  private watchId: string | null = null;
  private isTracking = false;
  private currentJobId: string | null = null;
  private currentTransporterId: string | null = null;

  constructor() {
    this.requestPermissions();
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async startTracking(jobId: string, transporterId: string): Promise<boolean> {
    if (this.isTracking) {
      console.warn('GPS tracking already active');
      return false;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Location permission not granted');
    }

    this.currentJobId = jobId;
    this.currentTransporterId = transporterId;
    this.isTracking = true;

    try {
      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: APP_CONFIG.gpsTrackingInterval,
          distanceInterval: 10, // meters
        },
        this.handleLocationUpdate.bind(this)
      );

      console.log('GPS tracking started for job:', jobId);
      return true;
    } catch (error) {
      console.error('Error starting GPS tracking:', error);
      this.isTracking = false;
      this.currentJobId = null;
      this.currentTransporterId = null;
      return false;
    }
  }

  stopTracking(): void {
    if (this.watchId) {
      this.watchId.remove();
      this.watchId = null;
    }
    
    this.isTracking = false;
    this.currentJobId = null;
    this.currentTransporterId = null;
    
    console.log('GPS tracking stopped');
  }

  isActive(): boolean {
    return this.isTracking;
  }

  private async handleLocationUpdate(location: Location.LocationObject) {
    if (!this.currentJobId || !this.currentTransporterId) {
      console.warn('GPS update received but no active job');
      return;
    }

    try {
      const gpsLog: Omit<GPSLog, 'log_id' | 'created_at'> = {
        job_id: this.currentJobId,
        transporter_id: this.currentTransporterId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        timestamp: new Date().toISOString(),
      };

      const result = await insertGPSLog(gpsLog);
      
      if (!result.success) {
        console.error('Failed to save GPS log:', result.error);
      }
    } catch (error) {
      console.error('Error handling location update:', error);
    }
  }

  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      return location;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }
}

// Singleton instance
export const gpsTracker = new GPSTracker();