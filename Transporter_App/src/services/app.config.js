// app.config.js
import 'dotenv/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

const ASSETS = {
  icon: './assets/icon.png',
  splash: './assets/splash.png',
  adaptiveIcon: './assets/adaptive-icon.png',
  favicon: './assets/favicon.png',
};

export default {
  expo: {
    name: IS_DEV ? 'Transporter MVP (Dev)' : 'Transporter MVP',
    slug: 'transporter-mvp',
    version: '1.0.0',
    orientation: 'portrait',
    icon: ASSETS.icon,
    userInterfaceStyle: 'light',
    splash: {
      image: ASSETS.splash,
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV
        ? 'com.dira.transporter.dev'
        : 'com.dira.transporter',
      infoPlist: {
        "UIViewControllerBasedStatusBarAppearance": true,      
        NSCameraUsageDescription:
          'This app uses the camera to scan QR codes and capture delivery receipts.',
        NSLocationWhenInUseUsageDescription:
          'This app uses your location to track transportation routes for job verification.',
        NSPhotoLibraryUsageDescription:
          'This app needs access to your photo library to upload delivery receipt photos.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: ASSETS.adaptiveIcon,
        backgroundColor: '#ffffff',
      },
      package: IS_DEV
        ? 'com.dira.transporter.dev'
        : 'com.dira.transporter',
      permissions: [
        'CAMERA',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
      ],
      versionCode: 1,
    },
    web: {
      favicon: ASSETS.favicon,
    },
    plugins: [
      'expo-secure-store',
      'expo-build-properties',
      [
        'expo-image-picker',
        {
          photosPermission:
            'The app needs access to your photos to let you upload delivery receipts.',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: process.env.EAS_PROJECT_ID || 'your-project-id-here',
      },
    },
    updates: {
      url:
        process.env.EAS_UPDATE_URL ||
        'https://u.expo.dev/your-project-id-here',
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: {
      policy: 'sdkVersion',
    },
    newArchEnabled: false,
    jsEngine: 'hermes',
  },
};
