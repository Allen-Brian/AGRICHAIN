// app.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HarvestLogScreen from './src/screens/HarvestLogScreen';
import HarvestLogsViewScreen from './src/screens/HarvestLogsViewScreen';


type RootStackParamList = {
  HarvestLog: undefined;
  ViewLogs: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="HarvestLog">
        <Stack.Screen 
          name="HarvestLog" 
          component={HarvestLogScreen} 
          options={{ title: 'Log Harvest' }}
        />
        <Stack.Screen 
          name="ViewLogs" 
          component={HarvestLogsViewScreen} 
          options={{ title: 'My Harvest Logs' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}