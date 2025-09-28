// HarvestLogScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Button, Alert, Image,
  ActivityIndicator, Platform, TouchableOpacity, FlatList, ScrollView,
  Animated, Easing, Dimensions
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../services/supabase';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { createHarvestRecord } from '../services/hedera-mobile';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';

async function generateUuidV4(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

type RootStackParamList = { HarvestLog: undefined; ViewLogs: undefined };
type NavigationProp = StackNavigationProp<RootStackParamList, 'HarvestLog'>;

const { width } = Dimensions.get('window');
const TEST_FARMER_ID = '1201a7cc-36e0-491c-8a68-9a7d1ef6ea37';

export default function HarvestLogScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [cropType, setCropType] = useState('');
  const [weight, setWeight] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hederaHash, setHederaHash] = useState<string | null>(null);
  const [hederaTxId, setHederaTxId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uniqueHarvestId, setUniqueHarvestId] = useState<string | null>(null);

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  const buttonScale = useState(new Animated.Value(1))[0];
  const progressWidth = useState(new Animated.Value(0))[0];
  const qrFadeAnim = useState(new Animated.Value(0))[0]; // Separate animation for QR section

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(progressWidth, {
      toValue: uploadProgress,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [uploadProgress]);

  // Animate QR section when it appears
  useEffect(() => {
    if (uniqueHarvestId && hederaHash) {
      Animated.timing(qrFadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [uniqueHarvestId, hederaHash]);

  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start();
  };

  const requestPermissions = async () => {
    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(locStatus === 'granted');

      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        setHasCameraPermission(cameraStatus === 'granted');
      } else setHasCameraPermission(true);

      if (locStatus === 'granted') {
        setLoadingLocation(true);
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        } catch (err) {
          console.error(err);
          Alert.alert('Location Error', 'Failed to get location. Using default.');
          setLocation({ latitude: 0, longitude: 0 });
        }
        setLoadingLocation(false);
      }
    } catch (err) {
      console.error(err);
      setLoadingLocation(false);
    }
  };

  useEffect(() => { requestPermissions(); }, []);

  const captureImage = async () => {
    try {
      animateButtonPress();
      
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        allowsMultipleSelection: Platform.OS === 'web',
      };
      const result = Platform.OS === 'web'
        ? await ImagePicker.launchImageLibraryAsync(options)
        : await ImagePicker.launchCameraAsync(options);

      if (!result.canceled && Array.isArray(result.assets) && result.assets.length > 0) {
        const newPhotos = result.assets.map(a => a.uri);
        
        // Animate photo addition
        setPhotoUris(prev => {
          const updated = [...prev, ...newPhotos];
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to take photo.');
    }
  };

  const removePhoto = (uri: string) => {
    animateButtonPress();
    setPhotoUris(photoUris.filter(u => u !== uri));
  };

  // Progressive upload to Supabase
  const uploadToSupabaseStorage = async (uri: string, fileName: string, onProgress?: (percent: number) => void): Promise<string> => {
    try {
      let file: string | Blob;

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        file = await response.blob();
      } else {
        const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        file = `data:image/jpeg;base64,${base64Data}`;
      }

      const totalChunks = 10;
      for (let i = 1; i <= totalChunks; i++) {
        await new Promise(res => setTimeout(res, 50));
        if (onProgress) onProgress(Math.round((i / totalChunks) * 100));
      }

      const { data, error } = await supabase.storage
        .from('harvest-photos')
        .upload(`${TEST_FARMER_ID}/${fileName}`, file, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('harvest-photos').getPublicUrl(data.path);
      return publicUrl;
    } catch (err) {
      console.error('Supabase upload error:', err);
      throw err;
    }
  };

  const submitHarvest = async () => {
    if (!cropType || !weight || photoUris.length === 0) {
      Alert.alert('Missing Information', 'Please enter crop type, weight, and take at least one photo.');
      return;
    }

    animateButtonPress();
    setSubmitting(true);
    setUploadProgress(0);

    try {
      const harvestId = await generateUuidV4();
      setUniqueHarvestId(harvestId);

      const storageUrls: string[] = [];
      for (let i = 0; i < photoUris.length; i++) {
        const fileName = `${harvestId}_photo_${i + 1}.jpg`;
        const url = await uploadToSupabaseStorage(photoUris[i], fileName, (percent) => {
          const photoPortion = 50 / photoUris.length;
          setUploadProgress(Math.round(i * photoPortion + (percent / 100) * photoPortion));
        });
        storageUrls.push(url);
      }

      const harvestData = {
        harvest_id: harvestId,
        farmer_id: TEST_FARMER_ID,
        crop_type: cropType,
        estimated_weight_kg: parseFloat(weight),
        gps_lat: location?.latitude || 0,
        gps_long: location?.longitude || 0,
        photo_urls: storageUrls,     
      };

      const harvestRecord = createHarvestRecord(harvestData);
      const hash = harvestRecord.hash;
      const txId = `local_${harvestId}`;

      setHederaHash(hash);
      setHederaTxId(txId);
      setUploadProgress(80);

      const { error } = await supabase.from('harvest_logs').insert([{
        ...harvestData,
        hedera_hash: hash,
        hedera_tx_id: txId,
      }]);
      if (error) throw error;

      setUploadProgress(100);
      
      // Animate success
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();

      Alert.alert('Success', `Harvest ${harvestId} recorded successfully! QR code generated for transport.`);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Submission Error', err.message || 'Failed to submit harvest. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    animateButtonPress();
    setCropType('');
    setWeight('');
    setPhotoUris([]);
    setHederaHash(null);
    setHederaTxId(null);
    setUniqueHarvestId(null);
    // Reset QR animation for next time
    qrFadeAnim.setValue(0);
  };

  const navigateToViewLogs = () => {
    animateButtonPress();
    navigation.navigate('ViewLogs');
  };

  if (hasLocationPermission === null || loadingLocation || hasCameraPermission === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E8B57" />
        <Text style={styles.loadingText}>Setting up your harvest logger...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>🌾</Text>
          <Text style={styles.title}>DIRA Harvest Logger</Text>
        </View>
        <Text style={styles.subtitle}>Record your harvest in simple steps</Text>
      </Animated.View>

      <Animated.View style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Crop Type</Text>
          <TextInput 
            placeholder="e.g., Maize, Wheat, Rice" 
            value={cropType} 
            onChangeText={setCropType} 
            style={styles.input} 
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput 
            placeholder="Enter weight in kilograms" 
            value={weight} 
            onChangeText={setWeight} 
            keyboardType="numeric" 
            style={styles.input} 
          />
        </View>

        <View style={styles.photoSection}>
          <Text style={styles.label}>Harvest Photos</Text>
          <Text style={styles.photoSubtext}>Take clear photos of your harvested crop</Text>
          
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity style={styles.photoButton} onPress={captureImage}>
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.photoButtonText}>
                {photoUris.length > 0 ? "Add More Photos" : "Take Photo"}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {photoUris.length > 0 && (
            <View style={styles.photosContainer}>
              <Text style={styles.photoCount}>{photoUris.length} photo(s) added</Text>
              <FlatList
                horizontal
                data={photoUris}
                keyExtractor={(item, index) => index.toString()}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.photoItem}>
                    <Image source={{ uri: item }} style={styles.preview} />
                    <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(item)}>
                      <Ionicons name="close-circle" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
          )}
        </View>

        {submitting && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>Uploading your harvest data...</Text>
              <Text style={styles.progressPercent}>{uploadProgress}%</Text>
            </View>
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, { width: progressWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%']
              }) }]} />
            </View>
          </View>
        )}

        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity 
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]} 
            onPress={submitHarvest} 
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="cloud-upload" size={20} color="#fff" />
            )}
            <Text style={styles.submitButtonText}>
              {submitting ? 'Processing...' : 'Submit Harvest'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {uniqueHarvestId && hederaHash && (
        <Animated.View 
          style={[styles.qrContainer, { opacity: qrFadeAnim }]}
        >
          <View style={styles.successCard}>
            <View style={styles.successHeader}>
              <Ionicons name="checkmark-circle" size={32} color="#2E8B57" />
              <Text style={styles.successTitle}>Harvest Recorded Successfully!</Text>
            </View>
            
            <View style={styles.qrCodeContainer}>
              <QRCode 
                value={JSON.stringify({
                  harvestId: uniqueHarvestId,
                  hash: hederaHash,
                  txId: hederaTxId,
                  farmerId: TEST_FARMER_ID,
                  cropType,
                  weight: parseFloat(weight)
                })} 
                size={200} 
              />
            </View>
            
            <Text style={styles.qrText}>Show this QR code to the transport team for pickup</Text>
            <Text style={styles.harvestId}>ID: {uniqueHarvestId}</Text>
            
            <TouchableOpacity onPress={resetForm} style={styles.newHarvestButton}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.newHarvestButtonText}>Log Another Harvest</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.viewLogsButton} onPress={navigateToViewLogs}>
          <Ionicons name="list" size={20} color="#fff" />
          <Text style={styles.viewLogsButtonText}>View My Harvest Logs</Text>
        </TouchableOpacity>
        
        <View style={styles.watermarkContainer}>
          <Text style={styles.watermark}>🌱 Built by DIRA - Sustainable Farming</Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// All your existing styles unchanged
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA', 
    paddingHorizontal: 20 
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#F8F9FA'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6C757D',
    fontFamily: 'System'
  },
  header: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    fontSize: 32,
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2E8B57',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    marginTop: 4,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#2E8B57',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    fontFamily: 'System',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    backgroundColor: '#F8F9FA',
    marginBottom: 4,
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    fontFamily: 'System',
    color: '#495057',
  },
  photoSection: {
    marginBottom: 20,
  },
  photoSubtext: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 16,
    fontFamily: 'System',
  },
  photoButton: {
    flexDirection: 'row',
    backgroundColor: '#2E8B57',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E8B57',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  photoButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
    fontFamily: 'System',
  },
  photosContainer: {
    marginTop: 16,
  },
  photoCount: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 12,
    fontFamily: 'System',
  },
  photoItem: {
    position: 'relative',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  preview: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#DC3545',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  progressContainer: {
    marginVertical: 20,
    padding: 16,
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#2E8B57',
    fontWeight: '500',
    fontFamily: 'System',
  },
  progressPercent: {
    fontSize: 14,
    color: '#2E8B57',
    fontWeight: '600',
    fontFamily: 'System',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#D1E7DD',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2E8B57',
    borderRadius: 4,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#2E8B57',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E8B57',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 18,
    marginLeft: 8,
    fontFamily: 'System',
  },
  qrContainer: {
    marginBottom: 20,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#2E8B57',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2E8B57',
    marginLeft: 8,
    fontFamily: 'System',
  },
  qrCodeContainer: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 16,
  },
  qrText: {
    fontSize: 16,
    color: '#495057',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'System',
    fontWeight: '500',
  },
  harvestId: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'System',
  },
  newHarvestButton: {
    flexDirection: 'row',
    backgroundColor: '#2E8B57',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#2E8B57',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  newHarvestButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
    fontFamily: 'System',
  },
  footer: {
    paddingBottom: 30,
  },
  viewLogsButton: {
    flexDirection: 'row',
    backgroundColor: '#6C757D',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#6C757D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  viewLogsButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
    fontFamily: 'System',
  },
  watermarkContainer: {
    alignItems: 'center',
  },
  watermark: {
    textAlign: 'center',
    color: '#ADB5BD',
    fontSize: 14,
    fontFamily: 'System',
  },
});
