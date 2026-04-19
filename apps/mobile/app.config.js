export default {
  expo: {
    name: "Masrafım",
    slug: "roadapp",
    owner: "memik",
    scheme: "roadmap",
    version: "1.0.0",
    orientation: "portrait",
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.masrafim.roadapp",
      buildNumber: "1",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Konumunuza erişim gereklidir."
      }
    },
    android: {
      package: "com.masrafim.roadapp",
      versionCode: 1,
      blockedPermissions: [
        "android.permission.RECORD_AUDIO"
      ],
      softwareKeyboardLayoutMode: "resize",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      }
    },
    plugins: [
      "expo-router",
      "expo-av",
      "expo-secure-store",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Rotanı mevcut konumundan başlatabilmek için konumuna erişmemiz gerekiyor."
        }
      ],
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: "35.0.0"
          }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "0e2bb8b5-f186-4d8b-bb85-79d3d649ca33"
      }
    }
  }
}
