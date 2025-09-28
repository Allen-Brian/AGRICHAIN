// src/screens/ScannerScreen.tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FooterWatermark } from '../components/FooterWatermark';
import { Header } from '../components/Header';
import { retrieveTransporter, supabase } from '../services/supabaseClient';
import { theme } from '../theme/theme';
import { RootStackParamList, Transporter, TransportJob } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export default function ScannerScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [transporter, setTransporter] = useState<Transporter | null>(null);
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const stored = await retrieveTransporter();
      setTransporter(stored);
      startScanAnimation();
    })();
  }, []);

  const startScanAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animation, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(animation, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  };

  // --- Safe job creation ---
  const createJob = async (harvestId: string, transporterId: string) => {
    try {
      // Check if a job already exists
      const { data: existingJob } = await supabase
        .from('transport_jobs')
        .select('*')
        .eq('harvest_id', harvestId)
        .single();

      if (existingJob) return existingJob as TransportJob;

      // Fetch harvest info
      const { data: harvest, error: harvestError } = await supabase
        .from('harvest_logs')
        .select('gps_lat, gps_long')
        .eq('harvest_id', harvestId)
        .single();

      if (harvestError || !harvest) {
        throw new Error('Could not find harvest info. Please contact support.');
      }

      // Try to get current GPS as pickup
      let pickupLocation = '';
      try {
        const location = await Location.getCurrentPositionAsync({});
        pickupLocation = `${location.coords.latitude},${location.coords.longitude}`;
      } catch {
        // Fallback to harvest GPS
        pickupLocation = `${harvest.gps_lat},${harvest.gps_long}`;
      }

      // Set delivery location placeholder (replace with real logic if available)
      const deliveryLocation = '0.0,0.0'; // TODO: replace with actual delivery location

      const scheduledPickupTime = new Date().toISOString();
      const scheduledDeliveryTime = new Date(Date.now() + 3600 * 1000).toISOString();

      const { data, error } = await supabase
        .from('transport_jobs')
        .insert([
          {
            harvest_id: harvestId,
            transporter_id: transporterId,
            status: 'ACCEPTED',
            pickup_location: pickupLocation,
            delivery_location: deliveryLocation,
            scheduled_pickup_time: scheduledPickupTime,
            scheduled_delivery_time: scheduledDeliveryTime,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      return data as TransportJob;
    } catch (err: any) {
      Alert.alert('Oops!', err.message || 'Unable to create job.');
      return null;
    }
  };

  // --- Handle scanned QR code ---
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      if (!transporter) {
        Alert.alert('Notice', 'You need to register before scanning.');
        return;
      }

      let parsed: { harvestId?: string };
      try {
        parsed = JSON.parse(data);
      } catch {
        Alert.alert('Invalid QR', 'The scanned QR code is not in the correct format.');
        return;
      }

      if (!parsed.harvestId) {
        Alert.alert('Invalid QR', 'The scanned QR code does not contain a valid harvest ID.');
        return;
      }

      const job = await createJob(parsed.harvestId, transporter.transporter_id);

      if (job?.job_id) {
        Alert.alert('Success', 'Transport job created successfully!');
        navigation.navigate('ActiveJobTab', { jobId: job.job_id });
      }
    } finally {
      setTimeout(() => setScanned(false), 2500);
    }
  };

  // --- Permission UI ---
  if (!permission) return <LoadingScreen message="Checking camera permissions..." />;
  if (!permission.granted) return <GrantPermissionScreen requestPermission={requestPermission} />;

  const scanLine = animation.interpolate({ inputRange: [0, 1], outputRange: [0, 250] });

  return (
    <View style={styles.container}>
      <Header title="Scan QR Code" />
      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
        <View style={styles.overlay}>
          <View style={styles.scanFrame}>
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLine }] }]} />
          </View>
          <Text style={styles.instructionText}>Align QR code inside the frame</Text>
        </View>
      </View>
      <FooterWatermark />
    </View>
  );
}

// --- Loading & permission UI ---
const LoadingScreen = ({ message }: { message: string }) => (
  <View style={styles.container}>
    <Header title="QR Scanner" />
    <View style={styles.centerContent}>
      <Text>{message}</Text>
    </View>
    <FooterWatermark />
  </View>
);

const GrantPermissionScreen = ({ requestPermission }: { requestPermission: () => void }) => (
  <View style={styles.container}>
    <Header title="QR Scanner" />
    <View style={styles.centerContent}>
      <Text style={styles.errorText}>Camera access is needed to scan QR codes.</Text>
      <TouchableOpacity style={styles.button} onPress={requestPermission}>
        <Text style={styles.buttonText}>Grant Permission</Text>
      </TouchableOpacity>
    </View>
    <FooterWatermark />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scannerContainer: { flex: 1, position: 'relative' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: '#fff', overflow: 'hidden' },
  scanLine: { width: '100%', height: 2, backgroundColor: theme.colors.primary },
  instructionText: { color: '#fff', fontSize: 16, marginTop: 20, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
  errorText: { ...theme.typography.h3, color: theme.colors.error, marginBottom: theme.spacing.lg, textAlign: 'center' },
  button: { backgroundColor: theme.colors.primary, padding: theme.spacing.lg, borderRadius: theme.borderRadius.md, alignItems: 'center' },
  buttonText: { ...theme.typography.h3, color: '#fff', fontWeight: '600' },
});
