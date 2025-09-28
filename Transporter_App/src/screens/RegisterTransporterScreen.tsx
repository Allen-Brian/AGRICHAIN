// RegisterTransporterScreen.tsx
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FooterWatermark } from '../components/FooterWatermark';
import { Header } from '../components/Header';
import { RootStackParamList } from '../navigation/AppNavigator';
import { registerTransporter, storeTransporter } from '../services/supabaseClient';
import { theme } from '../theme/theme';
import { Transporter, TransporterRegistrationForm } from '../types/models';

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
  onLogin: (transporter: Transporter) => void;
}

export default function RegisterTransporterScreen({ navigation, onLogin }: Props) {
  const [formData, setFormData] = useState<TransporterRegistrationForm>({
    full_name: '',
    phone: '',
    vehicle_type: '',
    vehicle_plate: '',
    license_id: '',
  });
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    if (!formData.full_name.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name');
      return false;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Validation Error', 'Please enter your phone number');
      return false;
    }
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(formData.phone.replace(/\s+/g, ''))) {
      Alert.alert('Validation Error', 'Please enter a valid phone number (e.g., +1234567890)');
      return false;
    }
    if (!formData.vehicle_type.trim()) {
      Alert.alert('Validation Error', 'Please enter your vehicle type');
      return false;
    }
    if (!formData.vehicle_plate.trim()) {
      Alert.alert('Validation Error', 'Please enter your vehicle plate number');
      return false;
    }
    if (!formData.license_id.trim()) {
      Alert.alert('Validation Error', 'Please enter your license ID');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await registerTransporter(formData);

      if (result?.success && result.data) {
        await storeTransporter(result.data);
        onLogin(result.data); // <--- Update parent state here

        Alert.alert('Success', 'Registration completed successfully!', [
          { text: 'OK', onPress: () => navigation.navigate('Dashboard') },
        ]);
      } else {
        Alert.alert('Registration Failed', result?.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to register: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof TransporterRegistrationForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <View style={styles.container}>
      <Header title="Register Transporter" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Personal Information</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.full_name}
            onChangeText={(value) => updateField('full_name', value)}
            placeholder="Enter your full name"
            autoCapitalize="words"
            editable={!loading}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(value) => updateField('phone', value)}
            placeholder="+1234567890"
            keyboardType="phone-pad"
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        <Text style={styles.sectionTitle}>Vehicle Information</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Vehicle Type *</Text>
          <TextInput
            style={styles.input}
            value={formData.vehicle_type}
            onChangeText={(value) => updateField('vehicle_type', value)}
            placeholder="e.g., Truck, Van, Refrigerated Truck"
            autoCapitalize="words"
            editable={!loading}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>License Plate *</Text>
          <TextInput
            style={styles.input}
            value={formData.vehicle_plate}
            onChangeText={(value) => updateField('vehicle_plate', value)}
            placeholder="Enter vehicle plate number"
            autoCapitalize="characters"
            editable={!loading}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Driver's License ID *</Text>
          <TextInput
            style={styles.input}
            value={formData.license_id}
            onChangeText={(value) => updateField('license_id', value)}
            placeholder="Enter your license ID"
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Registering...' : 'Complete Registration'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By registering, you agree to our terms of service. Your information will
          be securely stored and used solely for logistics operations.
        </Text>
      </ScrollView>

      <FooterWatermark />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollView: { flex: 1 },
  content: { padding: theme.spacing.lg },
  sectionTitle: {
    ...theme.typography.h2,
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  inputGroup: { marginBottom: theme.spacing.lg },
  label: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 16,
    backgroundColor: '#FFF',
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.textSecondary,
    opacity: 0.6,
  },
  submitButtonText: {
    ...theme.typography.h3,
    color: '#FFF',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  secondaryButtonText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  disclaimer: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
