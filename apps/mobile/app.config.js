export default {
  expo: {
    name: "RoadMap",
    slug: "roadmap",
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
      bundleIdentifier: "com.roadmap.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Konumunuza erişim gereklidir."
      }
    },
    android: {
      package: "com.roadmap.app",
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
      "expo-location"
    ],
    extra: {
      eas: {
        projectId: "your-eas-project-id"
      }
    }
  }
}
