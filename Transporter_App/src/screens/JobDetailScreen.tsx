// src/screens/JobDetailScreen.tsx
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { FooterWatermark } from '../components/FooterWatermark';
import { Header } from '../components/Header';
import { RootStackParamList } from '../navigation/AppNavigator';
import { markPickup } from '../services/jobActions';
import { getJobById } from '../services/supabaseClient';
import { theme } from '../theme/theme';
import { GPSLog, TransportJob } from '../types/models';

type JobDetailsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'JobDetails'>;
type JobDetailsScreenRouteProp = RouteProp<RootStackParamList, 'JobDetails'>;

interface Props {
  navigation: JobDetailsScreenNavigationProp;
  route: JobDetailsScreenRouteProp;
}

const NETWORK_TIMEOUT_MS = 10000;

export default function JobDetailsScreen({ navigation, route }: Props) {
  const { jobId } = route.params;
  const [job, setJob] = useState<TransportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      Alert.alert('Error', 'Job ID missing');
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      if (mounted) await loadJobDetails();
    })();
    return () => { mounted = false; };
  }, [jobId]);

  const withTimeout = async <T,>(p: Promise<T>, ms = NETWORK_TIMEOUT_MS): Promise<T> => {
    return Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
    ]) as Promise<T>;
  };

  const loadJobDetails = async () => {
    setLoading(true);
    try {
      const result = await withTimeout(getJobById(jobId));
      if (result && (result as any).success && (result as any).data) {
        setJob((result as any).data);
      } else {
        throw new Error((result as any)?.error || 'Job not found');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load job details');
      setJob(null);
    } finally {
      setLoading(false);
    }
  };

  const getGPSLogs = async (): Promise<GPSLog[]> => {
    if (!job) throw new Error('Job not loaded');
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

  const handleMarkPickup = async () => {
    if (!job) return;
    Alert.alert('Confirm Pickup', 'Mark this job as picked up?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
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
        }
      }
    ]);
  };

  const handleGoToReceiptUpload = () => {
    if (!job) return;
    navigation.navigate('ReceiptUpload', { jobId: job.job_id });
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

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Job Details" />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text>Loading job details...</Text>
        </View>
        <FooterWatermark />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.container}>
        <Header title="Job Details" />
        <View style={styles.centerContent}>
          <Text>Job not found</Text>
        </View>
        <FooterWatermark />
      </View>
    );
  }

  const formatDate = (date?: string | null) => date ? new Date(date).toLocaleString() : '-';

  return (
    <View style={styles.container}>
      <Header title="Job Details" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.jobHeader}>
          <Text style={styles.jobId}>Job #{job.job_id.slice(-8)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) }]}>
            <Text style={styles.statusText}>{formatStatus(job.status)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Harvest Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Harvest ID:</Text>
            <Text style={styles.value}>{job.harvest_id}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Pickup Time:</Text>
            <Text style={styles.value}>{formatDate(job.scheduled_pickup_time)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Delivery Time:</Text>
            <Text style={styles.value}>{formatDate(job.scheduled_delivery_time)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Actual Pickup:</Text>
            <Text style={styles.value}>{formatDate(job.actual_pickup_time)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Actual Delivery:</Text>
            <Text style={styles.value}>{formatDate(job.actual_delivery_time)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Locations</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Pickup:</Text>
            <Text style={styles.value}>{job.pickup_location}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Delivery:</Text>
            <Text style={styles.value}>{job.delivery_location}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Map Preview</Text>
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>
              Map integration would show here{'\n'}Coordinates: [Preview Only]
            </Text>
          </View>
        </View>

        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Actions</Text>

          {job.status === 'ACCEPTED' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleMarkPickup}
              disabled={actionLoading}
            >
              <Text style={styles.actionButtonText}>
                {actionLoading ? 'Processing...' : 'Mark Pickup'}
              </Text>
            </TouchableOpacity>
          )}

          {job.status === 'IN_TRANSIT' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleGoToReceiptUpload}
              disabled={actionLoading}
            >
              <Text style={styles.actionButtonText}>
                {actionLoading ? 'Processing...' : 'Upload Delivery Receipt'}
              </Text>
            </TouchableOpacity>
          )}
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
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  jobId: { ...theme.typography.h1, color: theme.colors.text },
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
  section: { marginBottom: theme.spacing.xl },
  sectionTitle: { ...theme.typography.h2, color: theme.colors.primary, marginBottom: theme.spacing.md },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
    paddingVertical: theme.spacing.xs
  },
  label: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600', flex: 1 },
  value: { ...theme.typography.body, color: theme.colors.textSecondary, flex: 2, textAlign: 'right' },
  mapPlaceholder: {
    height: 150,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  mapPlaceholderText: { ...theme.typography.caption, color: theme.colors.textSecondary, textAlign: 'center' },
  actionsSection: { marginTop: theme.spacing.lg },
  actionButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  actionButtonText: { ...theme.typography.h3, color: '#FFF', fontWeight: '600' }
});
