// HarvestLogsViewScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions,
  Animated,
  Easing
} from 'react-native';
import { supabase } from '../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
// ✅ Stick to legacy API (your original working approach)
import * as FileSystem from 'expo-file-system/legacy';
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');
const TEST_FARMER_ID = '1201a7cc-36e0-491c-8a68-9a7d1ef6ea37';

type HarvestLog = {
  harvest_id: string;
  crop_type: string;
  estimated_weight_kg: number;
  gps_lat: number;
  gps_long: number;
  photo_urls: string[];
  created_at: string;
  hedera_hash?: string;
  hedera_tx_id?: string;
  farmer_id: string;
};

export default function HarvestLogsViewScreen() {
  const [logs, setLogs] = useState<HarvestLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<HarvestLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideUpAnim = useState(new Animated.Value(30))[0];
  const scaleValues = useState(new Map())[0];
  const searchFocusAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const animateCardPress = (harvestId: string) => {
    const scaleValue = scaleValues.get(harvestId) || new Animated.Value(1);
    scaleValues.set(harvestId, scaleValue);

    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start();
  };

  const animateSearchFocus = (focused: boolean) => {
    Animated.timing(searchFocusAnim, {
      toValue: focused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // ✅ Fetch logs
  const fetchHarvestLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('harvest_logs')
        .select('*')
        .eq('farmer_id', TEST_FARMER_ID)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching harvest logs:', error);
        Alert.alert('Error', 'Failed to load harvest logs.');
        return;
      }
      setLogs(data || []);
      setFilteredLogs(data || []);
    } catch (err) {
      console.error('Unexpected fetch error:', err);
      Alert.alert('Error', 'Unexpected error loading logs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHarvestLogs();
  }, []);

  // ✅ Filter logs
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredLogs(logs);
    } else {
      const q = searchQuery.toLowerCase();
      const filtered = logs.filter(log =>
        log.crop_type.toLowerCase().includes(q) ||
        log.harvest_id.toLowerCase().includes(q) ||
        format(new Date(log.created_at), 'PPP').toLowerCase().includes(q)
      );
      setFilteredLogs(filtered);
    }
  }, [searchQuery, logs]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHarvestLogs();
  };

  // ✅ Generate & share PDF receipt (legacy FileSystem)
  const generateReceipt = async (log: HarvestLog) => {
    try {
      animateCardPress(log.harvest_id);
      const photoUrl = log.photo_urls && log.photo_urls[0] ? log.photo_urls[0] : '';

      const html = `
        <html>
          <head><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
          <body style="font-family: Arial, sans-serif; padding: 30px;">
            <h1 style="text-align:center;">Harvest Receipt</h1>
            <p><b>Receipt ID:</b> ${log.harvest_id}</p>
            <p><b>Date:</b> ${format(new Date(log.created_at), 'PPP p')}</p>
            <p><b>Crop Type:</b> ${log.crop_type}</p>
            <p><b>Weight:</b> ${log.estimated_weight_kg} kg</p>
            <p><b>Location:</b> ${log.gps_lat.toFixed(6)}, ${log.gps_long.toFixed(6)}</p>
            ${photoUrl ? `<img src="${photoUrl}" style="max-width:100%;height:auto;" />` : `<p><i>No photo available</i></p>`}
          </body>
        </html>
      `;

      // Create PDF
      const { uri } = await Print.printToFileAsync({ html });

      // ✅ Copy to persistent storage (legacy API)
      const pdfName = `${FileSystem.documentDirectory}harvest_receipt_${log.harvest_id}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: pdfName });

      // ✅ Share
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfName, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Harvest Receipt'
        });
      } else {
        Alert.alert('Receipt Generated', `PDF saved to: ${pdfName}`);
      }
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate receipt. Please try again.');
    }
  };

  // Render one log item
  const renderLogItem = ({ item }: { item: HarvestLog }) => {
    const scaleValue = scaleValues.get(item.harvest_id) || new Animated.Value(1);
    scaleValues.set(item.harvest_id, scaleValue);

    const qrValue = JSON.stringify({
      harvestId: item.harvest_id,
      hash: item.hedera_hash,
      txId: item.hedera_tx_id,
      farmerId: item.farmer_id
    });

    const photoUrl = item.photo_urls && item.photo_urls[0] ? item.photo_urls[0] : '';

    return (
      <Animated.View style={[styles.logCard, { transform: [{ scale: scaleValue }], opacity: fadeAnim }]}>
        <View style={styles.logHeader}>
          <View style={styles.cropBadge}>
            <Ionicons name="leaf" size={16} color="#fff" />
            <Text style={styles.cropType}>{item.crop_type}</Text>
          </View>
          <Text style={styles.date}>{format(new Date(item.created_at), 'MMM d, yyyy • h:mm a')}</Text>
        </View>

        <View style={styles.logContent}>
          <View style={styles.thumbnailContainer}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.thumbnail} />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons name="image" size={32} color="#CED4DA" />
              </View>
            )}
          </View>

          <View style={styles.logDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="scale-outline" size={18} color="#2E8B57" />
              <Text style={styles.detailText}>{item.estimated_weight_kg} kg</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={18} color="#2E8B57" />
              <Text style={styles.detailText}>{item.gps_lat.toFixed(4)}, {item.gps_long.toFixed(4)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="id-card-outline" size={18} color="#2E8B57" />
              <Text style={styles.detailText} numberOfLines={1}>{item.harvest_id}</Text>
            </View>
          </View>

          <View style={styles.qrBox}>
            <QRCode value={qrValue} size={70} />
            <Text style={styles.qrTextSmall}>Scan for transport</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.downloadButton} onPress={() => generateReceipt(item)}>
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.downloadButtonText}>Download Receipt</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#2E8B57" />
        <Text style={styles.loadingText}>Loading your harvest logs...</Text>
      </View>
    );
  }

  const searchContainerStyle = {
    ...styles.searchContainer,
    transform: [{
      scale: searchFocusAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] })
    }],
    shadowOpacity: searchFocusAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.2] })
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}>
        <Text style={styles.title}>My Harvest Logs</Text>
        <Text style={styles.subtitle}>Tap QR codes for transport pickup</Text>
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>{filteredLogs.length} harvest record(s)</Text>
        </View>
      </Animated.View>

      <Animated.View style={searchContainerStyle}>
        <Ionicons name="search-outline" size={20} color="#6C757D" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by crop, date, or ID..."
          placeholderTextColor="#ADB5BD"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => animateSearchFocus(true)}
          onBlur={() => animateSearchFocus(false)}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#6C757D" />
          </TouchableOpacity>
        )}
      </Animated.View>

      {filteredLogs.length === 0 ? (
        <Animated.View style={[styles.centerContent, { opacity: fadeAnim }]}>
          <Ionicons name="document-text-outline" size={80} color="#E9ECEF" />
          <Text style={styles.noLogsText}>
            {searchQuery ? 'No matching harvests found' : 'No harvest logs yet'}
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={filteredLogs}
          renderItem={renderLogItem}
          keyExtractor={item => item.harvest_id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', paddingHorizontal: 20 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  header: { paddingVertical: 25, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#2E8B57' },
  subtitle: { fontSize: 16, color: '#6C757D', marginTop: 6, textAlign: 'center' },
  statsContainer: { backgroundColor: '#E8F5E8', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 10 },
  statsText: { fontSize: 14, color: '#2E8B57', fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 24, elevation: 4 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, color: '#495057' },
  listContent: { paddingBottom: 30 },
  logCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 18, elevation: 5, borderLeftWidth: 4, borderLeftColor: '#2E8B57' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cropBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2E8B57', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  cropType: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 6 },
  date: { fontSize: 14, color: '#6C757D', flexShrink: 1, marginLeft: 10 },
  logContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  thumbnailContainer: { marginRight: 16 },
  thumbnail: { width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderColor: '#E9ECEF' },
  thumbnailPlaceholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#F8F9FA', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E9ECEF', borderStyle: 'dashed' },
  logDetails: { flex: 1, marginRight: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  detailText: { marginLeft: 10, fontSize: 14, color: '#495057', flex: 1 },
  qrBox: { alignItems: 'center' },
  qrTextSmall: { fontSize: 11, color: '#6C757D', marginTop: 6, textAlign: 'center', fontWeight: '500' },
  downloadButton: { flexDirection: 'row', backgroundColor: '#2E8B57', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  downloadButtonText: { color: '#fff', fontWeight: '600', marginLeft: 8, fontSize: 15 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6C757D' },
  noLogsText: { fontSize: 20, color: '#ADB5BD', marginTop: 16, textAlign: 'center', fontWeight: '600' }
});
