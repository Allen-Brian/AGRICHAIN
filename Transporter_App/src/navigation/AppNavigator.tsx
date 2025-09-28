// src/navigation/AppNavigator.tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import React from 'react';
import { Animated, Easing, Text, TouchableOpacity } from 'react-native';

import ActiveJobScreen from '../screens/ActiveJobScreen';
import DashboardScreen from '../screens/DashboardScreen';
import JobDetailsScreen from '../screens/JobDetailScreen';
import ReceiptUploadScreen from '../screens/ReceiptUploadScreen';
import RegisterTransporterScreen from '../screens/RegisterTransporterScreen';
import ScannerScreen from '../screens/ScannerScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import { RootStackParamList, Transporter } from '../types/models';
import { enableScreens } from 'react-native-screens';
enableScreens();


const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// Animated glowing header button
const HeaderButton = ({ title, onPress, color }: { title: string; onPress: () => void; color: string }) => {
  const glowAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.quad),
        }),
      ])
    ).start();
  }, [glowAnim]);

  const backgroundColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.3)'],
  });

  return (
    <Animated.View style={{ marginRight: 10, borderRadius: 6, backgroundColor }}>
      <TouchableOpacity onPress={onPress} style={{ padding: 6 }}>
        <Text style={{ color, fontSize: 16, fontWeight: '600' }}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Default stack options
const defaultOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: '#2196F3', shadowColor: 'transparent' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: 'bold' },
  animation: 'slide_from_right',
  statusBarStyle: 'light',
};

// Bottom tabs: only Dashboard and Active Jobs
function AppTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="DashboardTab" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen 
        name="ActiveJobTab" 
        component={ActiveJobScreen} 
        options={{ title: 'Active Job' }}
        // FIX: Remove parameters from tab screen to prevent undefined jobId
        initialParams={{ jobId: undefined }}
      />
    </Tab.Navigator>
  );
}

interface AppNavigatorProps {
  transporter: Transporter | null;
  onLogin: (transporter: Transporter) => void;
  onLogout: () => void;
}

export default function AppNavigator({ transporter, onLogin, onLogout }: AppNavigatorProps) {
  return (
    <Stack.Navigator
      initialRouteName={transporter ? 'Main' : 'Welcome'}
      screenOptions={defaultOptions}
    >
      {transporter ? (
        <>
          {/* Main app with tabs */}
          <Stack.Screen
            name="Main"
            component={AppTabs}
            options={{
              headerTitle: 'My Jobs',
              headerRight: () => <HeaderButton title="Logout" onPress={onLogout} color="#fff" />,
            }}
          />

          {/* Screens outside tabs for direct navigation */}
          <Stack.Screen
            name="JobDetails"
            component={JobDetailsScreen}
            options={{ title: 'Job Details', animation: 'fade' }}
          />
          <Stack.Screen
            name="ReceiptUpload"
            component={ReceiptUploadScreen}
            options={{ title: 'Upload Receipt', animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="Scanner"
            component={ScannerScreen}
            options={{ title: 'Scan QR Code', animation: 'fade' }}
          />
        </>
      ) : (
        <>
          {/* Welcome / register flow */}
          <Stack.Screen name="Welcome" options={{ title: 'Welcome', animation: 'fade' }}>
            {props => <WelcomeScreen {...props} onLogin={onLogin} />}
          </Stack.Screen>
          <Stack.Screen
            name="Register"
            options={{ title: 'Register Transporter', animation: 'slide_from_right' }}
          >
            {props => <RegisterTransporterScreen {...props} onLogin={onLogin} />}
          </Stack.Screen>
        </>
      )}
    </Stack.Navigator>
  );
}