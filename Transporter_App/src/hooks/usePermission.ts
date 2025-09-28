import { BarCodeScanner } from 'expo-barcode-scanner';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export const usePermissions = () => {
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);
  const [cameraPermission, setCameraPermission] = useState<ImagePicker.PermissionStatus | null>(null);
  const [qrPermission, setQrPermission] = useState<boolean>(false);

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    await checkLocationPermission();
    await checkCameraPermission();
    await checkQRPermission();
  };

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationPermission(status);
    return status === 'granted';
  };

  const checkCameraPermission = async () => {
    const { status } = await ImagePicker.getCameraPermissionsAsync();
    setCameraPermission(status);
    return status === 'granted';
  };

  const checkQRPermission = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setQrPermission(status === 'granted');
    return status === 'granted';
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status);
    return status === 'granted';
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    setCameraPermission(status);
    return status === 'granted';
  };

  const requestQRPermission = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setQrPermission(status === 'granted');
    return status === 'granted';
  };

  return {
    locationPermission,
    cameraPermission,
    qrPermission,
    requestLocationPermission,
    requestCameraPermission,
    requestQRPermission,
    checkAllPermissions,
    hasAllPermissions: locationPermission === 'granted' && cameraPermission === 'granted' && qrPermission,
  };
};