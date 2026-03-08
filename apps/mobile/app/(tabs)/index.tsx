import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import MapView, { PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import {
  YStack,
  XStack,
  Card,
  Text,
  H1,
  Paragraph,
  Button,
  Separator,
} from 'tamagui';
import { Navigation, Fuel, MapPin, Car, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { routeService } from '@/services/routeService';
import { vehicleService } from '@/services/vehicleService';
import type { Route, Vehicle } from '@/types/api';

interface Stats {
  totalRoutes: number;
  totalTollCost: number;
  totalFuelCost: number;
  totalCost: number;
  totalDistance: number;
  totalDuration: number;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentRoutes, setRecentRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // iOS: request location permission and get current position
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        } catch {
          // Use default Turkey region if location unavailable
        }
      }
    })();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, routesData, vehiclesData] = await Promise.all([
        routeService.getStats().catch(() => null),
        routeService.getAll(1, 5).catch(() => ({ data: [], meta: { total: 0, page: 1, lastPage: 1 } })),
        vehicleService.getAll().catch(() => []),
      ]);

      if (statsData) setStats(statsData);
      setRecentRoutes(routesData.data || []);
      setVehicles(vehiclesData || []);
    } catch (err) {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Ekrana her odaklanıldığında yenile (silme/ekleme sonrası güncel veri gelsin)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  const formatCurrency = (amount: number) =>
    `₺${Math.round(amount).toLocaleString('tr-TR')}`;

  const formatDistance = (meters: number) =>
    meters ? `${(meters / 1000).toFixed(0)} km` : '-';

  const formatDuration = (seconds: number) => {
    if (!seconds) return '-';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h === 0 ? `${m} dk` : `${h}s ${m}dk`;
  };

  const hasData = stats && stats.totalRoutes > 0;

  if (loading) {
    return (
      <YStack flex={1} backgroundColor="#F2F2F7" justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" color="#1C1C1E" />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="#F2F2F7">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1C1C1E"
          />
        }
      >
        {/* Hero — iOS: live Apple MapKit, Android: dark header */}
        {Platform.OS === 'ios' ? (
          <View style={heroStyles.mapHero}>
            <MapView
              style={StyleSheet.absoluteFillObject}
              provider={PROVIDER_DEFAULT}
              showsUserLocation
              showsCompass={false}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              region={userLocation
                ? { ...userLocation, latitudeDelta: 0.15, longitudeDelta: 0.15 }
                : { latitude: 39.0, longitude: 35.0, latitudeDelta: 12, longitudeDelta: 12 }
              }
            />
            {/* Gradient overlay for text readability */}
            <View style={heroStyles.gradient} />
            <View style={heroStyles.textOverlay}>
              <Text color="rgba(255,255,255,0.7)" fontSize={13} fontWeight="600" letterSpacing={0.8}>
                MERHABA
              </Text>
              <H1 color="white" fontSize={32} fontWeight="800" letterSpacing={-1} marginTop={2}>
                {user?.name || 'Kullanıcı'}
              </H1>
            </View>
          </View>
        ) : (
          <YStack
            backgroundColor="#1C1C1E"
            paddingTop={48}
            paddingHorizontal={24}
            paddingBottom={48}
          >
            <Text color="#6B7280" fontSize={14} fontWeight="500" letterSpacing={0.5}>MERHABA</Text>
            <H1 color="white" fontSize={34} fontWeight="800" letterSpacing={-1} marginTop={4}>
              {user?.name || 'Kullanıcı'}
            </H1>
            <Text color="#6B7280" fontSize={15} marginTop={6}>Yolculuk özetine hoş geldin</Text>
          </YStack>
        )}

        {/* Stats Cards — overlap the header */}
        <YStack marginTop={-28} paddingHorizontal={16}>
          {hasData ? (
            <XStack gap={10}>
              {/* Toplam */}
              <Card
                flex={1}
                backgroundColor="#EEF4FF"
                borderRadius={20}
                padding={16}
                animation="bouncy"
                enterStyle={{ opacity: 0, y: 24, scale: 0.92 }}
                elevate
              >
                <YStack gap={10}>
                  <YStack
                    width={36} height={36} borderRadius={12}
                    backgroundColor="#DBEAFE"
                    justifyContent="center" alignItems="center"
                  >
                    <Navigation size={18} color="#2563EB" />
                  </YStack>
                  <Text fontSize={20} fontWeight="800" color="#1E3A8A" letterSpacing={-0.5}>
                    {formatCurrency(stats.totalCost)}
                  </Text>
                  <Text fontSize={11} color="#3B82F6" fontWeight="600" letterSpacing={0.5}>
                    TOPLAM
                  </Text>
                </YStack>
              </Card>

              {/* Yakıt */}
              <Card
                flex={1}
                backgroundColor="#FFF7ED"
                borderRadius={20}
                padding={16}
                animation="bouncy"
                enterStyle={{ opacity: 0, y: 24, scale: 0.92 }}
                elevate
              >
                <YStack gap={10}>
                  <YStack
                    width={36} height={36} borderRadius={12}
                    backgroundColor="#FED7AA"
                    justifyContent="center" alignItems="center"
                  >
                    <Fuel size={18} color="#EA580C" />
                  </YStack>
                  <Text fontSize={20} fontWeight="800" color="#7C2D12" letterSpacing={-0.5}>
                    {formatCurrency(stats.totalFuelCost)}
                  </Text>
                  <Text fontSize={11} color="#F97316" fontWeight="600" letterSpacing={0.5}>
                    YAKIT
                  </Text>
                </YStack>
              </Card>

              {/* Gişe */}
              <Card
                flex={1}
                backgroundColor="#F0FFF4"
                borderRadius={20}
                padding={16}
                animation="bouncy"
                enterStyle={{ opacity: 0, y: 24, scale: 0.92 }}
                elevate
              >
                <YStack gap={10}>
                  <YStack
                    width={36} height={36} borderRadius={12}
                    backgroundColor="#BBF7D0"
                    justifyContent="center" alignItems="center"
                  >
                    <MapPin size={18} color="#16A34A" />
                  </YStack>
                  <Text fontSize={20} fontWeight="800" color="#14532D" letterSpacing={-0.5}>
                    {formatCurrency(stats.totalTollCost)}
                  </Text>
                  <Text fontSize={11} color="#22C55E" fontWeight="600" letterSpacing={0.5}>
                    GİŞE
                  </Text>
                </YStack>
              </Card>
            </XStack>
          ) : (
            <Card
              backgroundColor="white"
              borderRadius={24}
              padding={32}
              elevate
              animation="bouncy"
              enterStyle={{ opacity: 0, y: 20 }}
              alignItems="center"
            >
              <Navigation size={48} color="#D1D5DB" />
              <Text fontSize={17} fontWeight="700" color="#1C1C1E" marginTop={16}>
                Henüz rota yok
              </Text>
              <Text fontSize={14} color="#9CA3AF" marginTop={4} textAlign="center">
                İlk yolculuğunu hesapla
              </Text>
            </Card>
          )}
        </YStack>

        {/* Recent Routes */}
        {recentRoutes.length > 0 && (
          <YStack paddingHorizontal={16} marginTop={28}>
            <XStack justifyContent="space-between" alignItems="center" marginBottom={14}>
              <Text fontSize={20} fontWeight="700" color="#1C1C1E" letterSpacing={-0.5}>
                Son Rotalar
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                <Text color="#2563EB" fontWeight="600" fontSize={14}>Tümü</Text>
              </TouchableOpacity>
            </XStack>

            <YStack gap={10}>
              {recentRoutes.map((route, index) => (
                <TouchableOpacity
                  key={route.id}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({ pathname: '/route/[id]', params: { id: route.id } })
                  }
                >
                  <Card
                    backgroundColor="white"
                    borderRadius={16}
                    padding={16}
                    animation="bouncy"
                    enterStyle={{ opacity: 0, x: -16 }}
                  >
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack flex={1} marginRight={12}>
                        <Text fontSize={15} fontWeight="600" color="#1C1C1E" numberOfLines={1}>
                          {route.origin} → {route.destination}
                        </Text>
                        <Text fontSize={13} color="#9CA3AF" fontWeight="500" marginTop={4}>
                          {formatDistance(route.distance)} • {formatDuration(route.duration)}
                        </Text>
                      </YStack>
                      <Text fontSize={17} fontWeight="700" color="#1C1C1E" letterSpacing={-0.3}>
                        {formatCurrency(route.totalCost)}
                      </Text>
                    </XStack>
                  </Card>
                </TouchableOpacity>
              ))}
            </YStack>
          </YStack>
        )}

        {/* Vehicles */}
        {vehicles.length > 0 && (
          <YStack paddingHorizontal={16} marginTop={28}>
            <XStack justifyContent="space-between" alignItems="center" marginBottom={14}>
              <Text fontSize={20} fontWeight="700" color="#1C1C1E" letterSpacing={-0.5}>
                Araçlarım
              </Text>
              <TouchableOpacity onPress={() => router.push('/vehicles')}>
                <Text color="#2563EB" fontWeight="600" fontSize={14}>Tümü</Text>
              </TouchableOpacity>
            </XStack>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
            >
              {vehicles.map((v, index) => (
                <TouchableOpacity
                  key={v.id}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({ pathname: '/vehicles/[id]', params: { id: v.id } })
                  }
                >
                  <Card
                    backgroundColor="white"
                    borderRadius={16}
                    padding={16}
                    width={130}
                    alignItems="center"
                    animation="bouncy"
                    enterStyle={{ opacity: 0, y: 16 }}
                  >
                    <YStack
                      width={48} height={48} borderRadius={16}
                      backgroundColor="#EEF4FF"
                      justifyContent="center" alignItems="center"
                      marginBottom={10}
                    >
                      <Car size={24} color="#2563EB" />
                    </YStack>
                    <Text
                      fontSize={14} fontWeight="600" color="#1C1C1E"
                      textAlign="center" numberOfLines={1}
                    >
                      {v.name || `${(v as any).brand || ''} ${(v as any).model || ''}`}
                    </Text>
                    <Text fontSize={12} color="#9CA3AF" marginTop={2}>
                      {v.fuelType}
                    </Text>
                  </Card>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </YStack>
        )}

        <YStack height={120} />
      </ScrollView>
    </YStack>
  );
}

const heroStyles = StyleSheet.create({
  mapHero: {
    height: 260,
    overflow: 'hidden',
    position: 'relative',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  textOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 80,
    // Dark gradient from transparent to black-ish
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
