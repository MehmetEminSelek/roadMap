export default {
  expo: {
    name: "RoadMap",
    slug: "roadmap",
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
      package: "com.roadmap.app"
    },
    plugins: [
      "expo-router",
      "expo-av"
    ],
    extra: {
      eas: {
        projectId: "your-eas-project-id"
      }
    }
  }
}
