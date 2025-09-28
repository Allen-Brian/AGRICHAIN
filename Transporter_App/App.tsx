import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator'; // fixed import
import { clearTransporter, retrieveTransporter } from './src/services/supabaseClient';
import { Transporter } from './src/types/models';

export default function App() {
  const [transporter, setTransporter] = useState<Transporter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedTransporter = await retrieveTransporter();
        setTransporter(storedTransporter);
      } catch (error) {
        console.error('Error loading transporter:', error);
        Alert.alert('Error', 'Failed to load transporter data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = async () => {
    try {
      await clearTransporter();
      setTransporter(null);
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert('Error', 'Failed to logout');
    }
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <Text style={{ textAlign: 'center', marginTop: 50 }}>Loading...</Text>
        </NavigationContainer>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator
          transporter={transporter}
          onLogin={(transporter) => setTransporter(transporter)}
          onLogout={handleLogout}
        />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
