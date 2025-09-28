// RegisterTransporterScreen.tsx
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  
  // Refs for auto-scrolling and input management
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRefs = {
    full_name: useRef<TextInput>(null),
    phone: useRef<TextInput>(null),
    vehicle_type: useRef<TextInput>(null),
    vehicle_plate: useRef<TextInput>(null),
    license_id: useRef<TextInput>(null),
  };

  const validateForm = (): boolean => {
    if (!formData.full_name.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name');
      inputRefs.full_name.current?.focus();
      return false;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Validation Error', 'Please enter your phone number');
      inputRefs.phone.current?.focus();
      return false;
    }
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    const cleanPhone = formData.phone.replace(/\s+/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      Alert.alert('Validation Error', 'Please enter a valid phone number (e.g., +1234567890)');
      inputRefs.phone.current?.focus();
      return false;
    }
    if (!formData.vehicle_type.trim()) {
      Alert.alert('Validation Error', 'Please enter your vehicle type');
      inputRefs.vehicle_type.current?.focus();
      return false;
    }
    if (!formData.vehicle_plate.trim()) {
      Alert.alert('Validation Error', 'Please enter your vehicle plate number');
      inputRefs.vehicle_plate.current?.focus();
      return false;
    }
    if (!formData.license_id.trim()) {
      Alert.alert('Validation Error', 'Please enter your license ID');
      inputRefs.license_id.current?.focus();
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
        onLogin(result.data);

        Alert.alert('Success', 'Registration completed successfully!', [
          { 
            text: 'OK', 
            onPress: () => navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            })
          },
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

  const handleInputFocus = (fieldName: string) => {
    setFocusedInput(fieldName);
    // Auto-scroll to the focused input after a short delay
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: getScrollPosition(fieldName), animated: true });
    }, 300);
  };

  const getScrollPosition = (fieldName: string): number => {
    const fieldPositions: { [key: string]: number } = {
      full_name: 0,
      phone: 100,
      vehicle_type: 250,
      vehicle_plate: 400,
      license_id: 550,
    };
    return fieldPositions[fieldName] || 0;
  };

  const focusNextField = (currentField: keyof TransporterRegistrationForm) => {
    const fieldOrder: (keyof TransporterRegistrationForm)[] = [
      'full_name', 'phone', 'vehicle_type', 'vehicle_plate', 'license_id'
    ];
    const currentIndex = fieldOrder.indexOf(currentField);
    if (currentIndex < fieldOrder.length - 1) {
      inputRefs[fieldOrder[currentIndex + 1]].current?.focus();
    } else {
      // Last field - dismiss keyboard and show submit button
      Keyboard.dismiss();
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <Header title="Register Transporter" />

          <ScrollView 
            ref={scrollViewRef}
            style={styles.scrollView} 
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionTitle}>Personal Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                ref={inputRefs.full_name}
                style={[
                  styles.input, 
                  focusedInput === 'full_name' && styles.inputFocused
                ]}
                value={formData.full_name}
                onChangeText={(value) => updateField('full_name', value)}
                onFocus={() => handleInputFocus('full_name')}
                onBlur={() => setFocusedInput(null)}
                onSubmitEditing={() => focusNextField('full_name')}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                autoCapitalize="words"
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                ref={inputRefs.phone}
                style={[
                  styles.input, 
                  focusedInput === 'phone' && styles.inputFocused
                ]}
                value={formData.phone}
                onChangeText={(value) => updateField('phone', value)}
                onFocus={() => handleInputFocus('phone')}
                onBlur={() => setFocusedInput(null)}
                onSubmitEditing={() => focusNextField('phone')}
                placeholder="+1234567890"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                autoCapitalize="none"
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            <Text style={styles.sectionTitle}>Vehicle Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Vehicle Type *</Text>
              <TextInput
                ref={inputRefs.vehicle_type}
                style={[
                  styles.input, 
                  focusedInput === 'vehicle_type' && styles.inputFocused
                ]}
                value={formData.vehicle_type}
                onChangeText={(value) => updateField('vehicle_type', value)}
                onFocus={() => handleInputFocus('vehicle_type')}
                onBlur={() => setFocusedInput(null)}
                onSubmitEditing={() => focusNextField('vehicle_type')}
                placeholder="e.g., Truck, Van, Refrigerated Truck"
                placeholderTextColor="#999"
                autoCapitalize="words"
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>License Plate *</Text>
              <TextInput
                ref={inputRefs.vehicle_plate}
                style={[
                  styles.input, 
                  focusedInput === 'vehicle_plate' && styles.inputFocused
                ]}
                value={formData.vehicle_plate}
                onChangeText={(value) => updateField('vehicle_plate', value)}
                onFocus={() => handleInputFocus('vehicle_plate')}
                onBlur={() => setFocusedInput(null)}
                onSubmitEditing={() => focusNextField('vehicle_plate')}
                placeholder="Enter vehicle plate number"
                placeholderTextColor="#999"
                autoCapitalize="characters"
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Driver's License ID *</Text>
              <TextInput
                ref={inputRefs.license_id}
                style={[
                  styles.input, 
                  focusedInput === 'license_id' && styles.inputFocused
                ]}
                value={formData.license_id}
                onChangeText={(value) => updateField('license_id', value)}
                onFocus={() => handleInputFocus('license_id')}
                onBlur={() => setFocusedInput(null)}
                onSubmitEditing={handleSubmit}
                placeholder="Enter your license ID"
                placeholderTextColor="#999"
                autoCapitalize="none"
                returnKeyType="done"
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
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
  },
  scrollView: { 
    flex: 1 
  },
  content: { 
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2 // Extra padding for keyboard
  },
  sectionTitle: {
    ...theme.typography.h2,
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  inputGroup: { 
    marginBottom: theme.spacing.lg 
  },
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
    minHeight: 50,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    marginTop: theme.spacing.md,
  },
});