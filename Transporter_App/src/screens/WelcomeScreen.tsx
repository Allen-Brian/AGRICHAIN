import { StackNavigationProp } from '@react-navigation/stack';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { APP_CONFIG } from '../../config';
import { FooterWatermark } from '../components/FooterWatermark';
import { Header } from '../components/Header';
import { RootStackParamList } from '../navigation/AppNavigator';
import { theme } from '../theme/theme';

type WelcomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Welcome'>;

interface Props {
  navigation: WelcomeScreenNavigationProp;
  onLogin: (transporter: any) => void;
}

export default function WelcomeScreen({ navigation, onLogin }: Props) {
  const handleDemoDashboard = () => {
    Alert.alert(
      'Demo Mode',
      'To access the Dashboard, please register or login first.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  return (
    <View style={styles.container}>
      <Header title={`${APP_CONFIG.name} — built by ${APP_CONFIG.brand}`} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Welcome to {APP_CONFIG.name}</Text>
          <Text style={styles.heroSubtitle}>
            Efficient, transparent agricultural logistics powered by blockchain technology
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.primaryButtonText}>Register / Login</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={handleDemoDashboard}
          >
            <Text style={styles.secondaryButtonText}>Dashboard (Demo)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Features</Text>
          <View style={styles.featureItem}>
            <Text style={styles.featureText}>• QR Code Scanning for Harvest Verification</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureText}>• Real-time GPS Tracking</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureText}>• Digital Delivery Receipts</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureText}>• Blockchain-based Audit Trail</Text>
          </View>
        </View>
      </ScrollView>

      <FooterWatermark />
    </View>
  );
}

// ...styles same as previous


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, padding: theme.spacing.lg },
  heroSection: { alignItems: 'center', marginBottom: theme.spacing.xxl, marginTop: theme.spacing.xl },
  heroTitle: { ...theme.typography.h1, color: theme.colors.primary, textAlign: 'center', marginBottom: theme.spacing.sm },
  heroSubtitle: { ...theme.typography.body, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  buttonContainer: { gap: theme.spacing.md, marginBottom: theme.spacing.xxl },
  primaryButton: { backgroundColor: theme.colors.primary, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, alignItems: 'center' },
  primaryButtonText: { ...theme.typography.h3, color: '#FFFFFF', fontWeight: '600' },
  secondaryButton: { backgroundColor: theme.colors.surface, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, alignItems: 'center', borderWidth: 2, borderColor: theme.colors.primary },
  secondaryButtonText: { ...theme.typography.h3, color: theme.colors.primary, fontWeight: '600' },
  featuresSection: { backgroundColor: theme.colors.surface, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg },
  featuresTitle: { ...theme.typography.h2, color: theme.colors.text, marginBottom: theme.spacing.md, textAlign: 'center' },
  featureItem: { marginBottom: theme.spacing.sm },
  featureText: { ...theme.typography.body, color: theme.colors.textSecondary },
});
