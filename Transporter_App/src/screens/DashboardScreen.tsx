// src/screens/DashboardScreen.tsx
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FooterWatermark } from '../components/FooterWatermark';
import { Header } from '../components/Header';
import { RootStackParamList } from '../navigation/AppNavigator';
import { markDelivery, markPickup } from '../services/jobActions';
import { getJobById, retrieveTransporter } from '../services/supabaseClient'; // FIX: Added retrieveTransporter import
import { theme } from '../theme/theme';
import { GPSLog, TransportJob } from '../types/models';

// FIX: Correct navigation types for tab navigation
type DashboardScreenNavigationProp = BottomTabNavigationProp<RootStackParamList, 'DashboardTab'>;
type DashboardScreenRouteProp = RouteProp<RootStackParamList, 'DashboardTab'>;

interface Props {
  navigation: DashboardScreenNavigationProp;
  route: DashboardScreenRouteProp;
}

const NETWORK_TIMEOUT_MS = 10000;

export default function DashboardScreen({ navigation, route }: Props) {
  const { jobId } = route.params ?? {};
  const [job, setJob] = useState<TransportJob | null>(null);
  const [transporter, setTransporter] = useState<any>(null); // FIX: Added transporter state
  const [loading, setLoading] = useState<boolean>(Boolean(jobId));
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      loadTransporter(); // FIX: Load transporter even if no jobId
      return;
    }
    let mounted = true;
    (async () => {
      if (mounted) {
        await loadTransporter();
        await loadJobDetails();
      }
    })();
    return () => { mounted = false; };
  }, [jobId]);

  // FIX: Load transporter data
  const loadTransporter = async () => {
    try {
      const transporterData = await retrieveTransporter();
      setTransporter(transporterData);
    } catch (error) {
      console.log('Error loading transporter:', error);
    }
  };

  const withTimeout = async <T,>(p: Promise<T>, ms = NETWORK_TIMEOUT_MS): Promise<T> => {
    return Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
    ]) as Promise<T>;
  };

  const loadJobDetails = async () => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await withTimeout(getJobById(jobId));
      if (result && (result as any).success && (result as any).data) {
        setJob((result as any).data);
      } else {
        const errMsg = (result as any)?.error || 'Job not found';
        throw new Error(errMsg);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load job details');
      setJob(null);
    } finally {
      setLoading(false);
    }
  };

  /** Auto-capture GPS and return full GPSLog array (single sample) */
  const getGPSLogs = async (): Promise<GPSLog[]> => {
    if (!job) throw new Error("Job not loaded");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Location permission denied');
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    const now = new Date().toISOString();
    return [
      {
        log_id: `gps-${Date.now()}`,
        job_id: job.job_id,
        transporter_id: job.transporter_id,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude ?? 0,
        speed: loc.coords.speed ?? 0,
        accuracy: loc.coords.accuracy ?? 0,
        timestamp: now,
        created_at: now,
      },
    ];
  };

  const pickImage = async (): Promise<string> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if ((result as any).canceled || !((result as any).assets?.length)) {
      return '';
    }
    return (result as any).assets[0].uri || '';
  };

  /** Auto-mark Pickup — captures GPS and submits to backend */
  const handleMarkPickup = async () => {
    if (!job) {
      Alert.alert('No job', 'No job loaded to mark pickup.');
      return;
    }
    setActionLoading(true);
    try {
      const gpsLogs = await getGPSLogs();
      const res = await markPickup(job, gpsLogs);
      if (!res || !res.success) throw new Error(res?.error || 'Pickup failed');
      Alert.alert('Success', 'Pickup recorded with GPS');
      await loadJobDetails();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to mark pickup');
    } finally {
      setActionLoading(false);
    }
  };

  /** Auto-mark Delivery — captures GPS, asks for photo (optional) and submits */
  const handleMarkDelivery = async () => {
    if (!job) {
      Alert.alert('No job', 'No job loaded to mark delivery.');
      return;
    }
    setActionLoading(true);
    try {
      const gpsLogs = await getGPSLogs();
      let photoUri = '';
      try { 
        photoUri = await pickImage(); 
      } catch (_subErr) { 
        photoUri = ''; 
      }
      const res = await markDelivery(job, photoUri, gpsLogs);
      if (!res || !res.success) throw new Error(res?.error || 'Delivery failed');
      Alert.alert('Success', 'Delivery recorded with GPS & photo');
      await loadJobDetails();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to mark delivery');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return theme.colors.warning;
      case 'ACCEPTED': return theme.colors.primary;
      case 'IN_TRANSIT': return theme.colors.secondary;
      case 'DELIVERED': return theme.colors.success;
      case 'CANCELLED': return theme.colors.error;
      default: return theme.colors.textSecondary;
    }
  };

  const formatStatus = (status: string) => status.replace('_', ' ').toUpperCase();

  if (loading) return (
    <View style={styles.container}>
      <Header title="Dashboard" />
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text>Loading job details...</Text>
      </View>
      <FooterWatermark />
    </View>
  );

  if (!job) return (
    <View style={styles.container}>
      <Header title="Dashboard" />
      <View style={styles.centerContent}>
        <Text style={styles.noJobText}>No active job</Text>
        <Text style={styles.noJobSubtext}>Scan a QR code to start a transport job</Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate('Scanner')} // FIX: Correct navigation
        >
          <Text style={styles.scanButtonText}>Scan QR Code</Text>
        </TouchableOpacity>
      </View>
      <FooterWatermark />
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Dashboard" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.jobHeader}>
          <Text style={styles.jobId}>Job #{job.job_id.slice(-8)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) }]}>
            <Text style={styles.statusText}>{formatStatus(job.status)}</Text>
          </View>
        </View>

        <View style={styles.jobInfo}>
          <Text style={styles.harvestId}>Harvest: {job.harvest_id}</Text>
          <Text style={styles.locationText}>From: {job.pickup_location}</Text>
          <Text style={styles.locationText}>To: {job.delivery_location}</Text>
        </View>

        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          {job.status === 'ACCEPTED' && (
            <TouchableOpacity style={styles.actionButton} onPress={handleMarkPickup} disabled={actionLoading}>
              <Text style={styles.actionButtonText}>{actionLoading ? 'Processing...' : 'Mark Pickup'}</Text>
            </TouchableOpacity>
          )}

          {job.status === 'IN_TRANSIT' && (
            <TouchableOpacity style={styles.actionButton} onPress={handleMarkDelivery} disabled={actionLoading}>
              <Text style={styles.actionButtonText}>{actionLoading ? 'Processing...' : 'Mark Delivery'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={() => navigation.navigate('Scanner')} // FIX: Removed jobId parameter
          >
            <Text style={styles.secondaryButtonText}>Scan QR Code</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('JobDetails', { jobId: job.job_id })}
          >
            <Text style={styles.secondaryButtonText}>View Job Details</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <FooterWatermark />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollView: { flex: 1 },
  content: { padding: theme.spacing.lg },
  centerContent: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: theme.spacing.lg 
  },
  noJobText: { 
    ...theme.typography.h2, 
    color: theme.colors.text, 
    marginBottom: theme.spacing.sm,
    textAlign: 'center'
  },
  noJobSubtext: { 
    ...theme.typography.body, 
    color: theme.colors.textSecondary, 
    textAlign: 'center',
    marginBottom: theme.spacing.xl
  },
  scanButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center'
  },
  scanButtonText: {
    ...theme.typography.h3,
    color: '#FFF',
    fontWeight: '600'
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  jobId: { ...theme.typography.h1, color: theme.colors.text },
  jobInfo: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg
  },
  harvestId: { 
    ...theme.typography.h3, 
    color: theme.colors.text,
    marginBottom: theme.spacing.sm
  },
  locationText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs
  },
  statusBadge: { 
    paddingHorizontal: theme.spacing.md, 
    paddingVertical: theme.spacing.sm, 
    borderRadius: theme.borderRadius.sm 
  },
  statusText: { 
    ...theme.typography.caption, 
    color: '#FFF', 
    fontWeight: '600', 
    textTransform: 'uppercase' 
  },
  sectionTitle: { 
    ...theme.typography.h2, 
    color: theme.colors.primary, 
    marginBottom: theme.spacing.md 
  },
  actionsSection: { marginTop: theme.spacing.lg },
  actionButton: { 
    backgroundColor: theme.colors.primary, 
    padding: theme.spacing.lg, 
    borderRadius: theme.borderRadius.md, 
    alignItems: 'center', 
    marginBottom: theme.spacing.md 
  },
  actionButtonText: { 
    ...theme.typography.h3, 
    color: '#FFF', 
    fontWeight: '600' 
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary
  },
  secondaryButtonText: {
    ...theme.typography.h3,
    color: theme.colors.primary,
    fontWeight: '600'
  }
});