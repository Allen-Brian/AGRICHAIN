// src/screens/ActiveJobScreen.tsx
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { FooterWatermark } from '../components/FooterWatermark';
import { Header } from '../components/Header';
import { gpsTracker } from '../services/gpsTracker';
import { submitReceipt } from '../services/jobActions';
import { retrieveTransporter, supabase } from '../services/supabaseClient';
import { theme } from '../theme/theme';
import { GPSLog, RootStackParamList, TransportJob } from '../types/models';

type ActiveJobScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ActiveJobTab'
>;

type ActiveJobScreenRouteProp = RouteProp<RootStackParamList, 'ActiveJobTab'>;

interface Props {
  navigation: ActiveJobScreenNavigationProp;
  route: ActiveJobScreenRouteProp;
}

export default function ActiveJobScreen({ navigation, route }: Props) {
  const { jobId } = route.params || {};
  const [job, setJob] = useState<TransportJob | null>(null);
  const [transporter, setTransporter] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsLogs, setGpsLogs] = useState<GPSLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasActiveJob, setHasActiveJob] = useState(false);

  useEffect(() => {
    loadJobData();
    return () => {
      if (isTracking) gpsTracker.stopTracking();
    };
  }, [jobId]);

  const loadJobData = async () => {
    try {
      const transporterData = await retrieveTransporter();
      setTransporter(transporterData);

      let jobData;
      if (jobId) {
        const res = await supabase.from('transport_jobs').select('*').eq('job_id', jobId).single();
        jobData = res.data;
      } else {
        const res = await supabase
          .from('transport_jobs')
          .select('*')
          .eq('transporter_id', transporterData?.transporter_id)
          .in('status', ['ACCEPTED', 'IN_TRANSIT'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        jobData = res.data;
        if (jobData && route.params) route.params.jobId = jobData.job_id;
      }

      if (jobData) {
        setJob(jobData);
        setHasActiveJob(true);
        if (jobData.status === 'IN_TRANSIT' && !isTracking) startTracking();
      } else {
        setHasActiveJob(false);
      }

      await loadGPSLogs(jobData?.job_id);
    } catch (err: any) {
      console.error('Job load error:', err.message);
      setHasActiveJob(false);
    } finally {
      setLoading(false);
    }
  };

  const loadGPSLogs = async (job_id?: string) => {
    if (!job_id) return;
    try {
      const { data, error } = await supabase
        .from('transport_gps_logs')
        .select('*')
        .eq('job_id', job_id)
        .order('timestamp', { ascending: true });
      if (error) throw error;
      setGpsLogs(data || []);
    } catch (err: any) {
      console.error('GPS logs load error:', err.message);
    }
  };

  const startTracking = async () => {
    if (!transporter || !job) return Alert.alert('Error', 'Transporter or job missing');
    const success = await gpsTracker.startTracking(job.job_id, transporter.transporter_id);
    if (success) {
      setIsTracking(true);
      Alert.alert('Tracking Started', 'GPS tracking is active');
    } else Alert.alert('Error', 'Failed to start GPS tracking');
  };

  const stopTracking = () => {
    gpsTracker.stopTracking();
    setIsTracking(false);
    Alert.alert('Tracking Stopped', 'GPS tracking has been disabled');
  };

  const getCurrentLocation = async () => {
    const location = await gpsTracker.getCurrentLocation();
    if (!location) return Alert.alert('Error', 'Unable to get location');
    Alert.alert(
      'Current Location',
      `Lat: ${location.coords.latitude.toFixed(6)}\nLon: ${location.coords.longitude.toFixed(6)}`
    );
  };

  const calculateDistance = (logs: GPSLog[]): number => {
    if (logs.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < logs.length; i++) total += haversineDistance(logs[i - 1], logs[i]);
    return parseFloat(total.toFixed(2));
  };

  const haversineDistance = (p1: GPSLog, p2: GPSLog) => {
    const R = 6371; // km
    const dLat = toRad(p2.latitude - p1.latitude);
    const dLon = toRad(p2.longitude - p1.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(p1.latitude)) * Math.cos(toRad(p2.latitude)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const toRad = (deg: number) => deg * (Math.PI / 180);

  const handleSubmitReceipt = async () => {
    if (!job) return Alert.alert('Error', 'Job missing');
    const topicRes = await createTopic(job);
    if (!topicRes?.topicId) throw new Error('Topic creation failed');

    const payload = {
      job_id: job.job_id,
      harvest_id: job.harvest_id,
      transporter_id: transporter?.transporter_id,
      gps_points_count: gpsLogs.length,
      total_distance: calculateDistance(gpsLogs),
      timestamp: new Date().toISOString()
    };

    const res = await submitReceipt(topicRes.topicId, payload);
    if (res.success) Alert.alert('Success', 'Receipt submitted to Hedera');
    else Alert.alert('Error', res.message || 'Unknown error');
  };

  const createTopic = async (job: TransportJob): Promise<{ topicId: string } | null> => {
    return { topicId: `topic-${job.job_id}` };
  };

  if (loading) return (
    <View style={styles.container}><Header title="Active Job" /><View style={styles.centerContent}><Text>Loading...</Text></View><FooterWatermark /></View>
  );

  if (!hasActiveJob) return (
    <View style={styles.container}><Header title="Active Job" /><View style={styles.centerContent}><Text>No active job found</Text></View><FooterWatermark /></View>
  );

  return (
    <View style={styles.container}>
      <Header title="Active Job" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.jobInfo}>
          <Text style={styles.jobId}>Job #{job?.job_id.slice(-8)}</Text>
          <Text style={styles.harvestId}>Harvest: {job?.harvest_id}</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{gpsLogs.length}</Text>
            <Text style={styles.statLabel}>GPS Points</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{calculateDistance(gpsLogs)} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{isTracking ? 'Active' : 'Inactive'}</Text>
            <Text style={styles.statLabel}>Status</Text>
          </View>
        </View>

        <View style={styles.trackingSection}>
          <Text style={styles.sectionTitle}>GPS Tracking</Text>
          {!isTracking ? (
            <TouchableOpacity style={styles.primaryButton} onPress={startTracking}><Text style={styles.primaryButtonText}>Start GPS Tracking</Text></TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopButton} onPress={stopTracking}><Text style={styles.stopButtonText}>Stop GPS Tracking</Text></TouchableOpacity>
          )}
          <TouchableOpacity style={styles.secondaryButton} onPress={getCurrentLocation}><Text style={styles.secondaryButtonText}>Get Current Location</Text></TouchableOpacity>
        </View>

        <View style={styles.mapSection}>
          <Text style={styles.sectionTitle}>Route Map</Text>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: gpsLogs[0]?.latitude || 0,
              longitude: gpsLogs[0]?.longitude || 0,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01
            }}
          >
            {gpsLogs.map((log, idx) => (
              <Marker key={idx} coordinate={{ latitude: log.latitude, longitude: log.longitude }} />
            ))}
            {gpsLogs.length > 1 && (
              <Polyline coordinates={gpsLogs.map(log => ({ latitude: log.latitude, longitude: log.longitude }))} strokeColor={theme.colors.primary} strokeWidth={4} />
            )}
          </MapView>
        </View>

        <TouchableOpacity style={styles.receiptButton} onPress={handleSubmitReceipt}>
          <Text style={styles.receiptButtonText}>Submit Delivery Receipt</Text>
        </TouchableOpacity>
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
  jobInfo: { marginBottom: theme.spacing.lg, paddingBottom: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  jobId: { ...theme.typography.h2, color: theme.colors.text },
  harvestId: { ...theme.typography.body, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: theme.colors.surface, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, marginBottom: theme.spacing.lg },
  statItem: { alignItems: 'center' },
  statNumber: { ...theme.typography.h1, color: theme.colors.primary },
  statLabel: { ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  trackingSection: { marginBottom: theme.spacing.xl, gap: theme.spacing.md },
  primaryButton: { backgroundColor: theme.colors.primary, padding: theme.spacing.lg, borderRadius: theme.borderRadius.md, alignItems: 'center' },
  primaryButtonText: { ...theme.typography.h3, color: '#FFF', fontWeight: '600' },
  stopButton: { backgroundColor: theme.colors.error, padding: theme.spacing.lg, borderRadius: theme.borderRadius.md, alignItems: 'center' },
  stopButtonText: { ...theme.typography.h3, color: '#FFF', fontWeight: '600' },
  secondaryButton: { backgroundColor: theme.colors.surface, padding: theme.spacing.lg, borderRadius: theme.borderRadius.md, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.primary },
  secondaryButtonText: { ...theme.typography.h3, color: theme.colors.primary, fontWeight: '600' },
  mapSection: { marginBottom: theme.spacing.xl },
  map: { height: 300, borderRadius: theme.borderRadius.md },
  receiptButton: { backgroundColor: theme.colors.success, padding: theme.spacing.lg, borderRadius: theme.borderRadius.md, alignItems: 'center', marginTop: theme.spacing.lg },
  receiptButtonText: { ...theme.typography.h3, color: '#FFF', fontWeight: '600' },
  sectionTitle: { ...theme.typography.h2, color: theme.colors.primary, marginBottom: theme.spacing.md }
});
