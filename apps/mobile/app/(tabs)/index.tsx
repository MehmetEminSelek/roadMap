import { useState, useCallback } from 'react';
import {
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { PROVIDER_DEFAULT } from 'react-native-maps';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import * as Location from 'expo-location';
import { Navigation, Fuel, MapPin, Car, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { routeService } from '@/services/routeService';
import { vehicleService } from '@/services/vehicleService';
import type { Route, Vehicle } from '@/types/api';
import { C } from '@/theme';

interface Stats {
  totalRoutes: number;
  totalTollCost: number;
  totalFuelCost: number;
  totalCost: number;
  totalDistance: number;
  totalDuration: number;
  weeklyCost: number;
  monthlyCost: number;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentRoutes, setRecentRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Request location once (both platforms)
  const requestLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        // use default Turkey region
      }
    }
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
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      if (!userLocation) requestLocation();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  const formatCurrency = (amount: number) => `₺${Math.round(amount).toLocaleString('tr-TR')}`;
  const formatDistance = (meters: number) => meters ? `${(meters / 1000).toFixed(0)} km` : '-';
  const formatDuration = (seconds: number) => {
    if (!seconds) return '-';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h === 0 ? `${m} dk` : `${h}s ${m}dk`;
  };

  const hasData = stats && stats.totalRoutes > 0;

  if (loading) {
    return (
      <View style={[styles.fill, styles.centered]}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />
        }
      >
        {/* ── Hero ──────────────────────────────── */}
        <View style={[hero.mapHero, { paddingTop: insets.top, height: 260 + insets.top }]}>
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
          <View style={hero.overlay} />
          <View style={[hero.statusBarScrim, { height: insets.top }]} />
          <View style={hero.textOverlay}>
            <Text style={hero.greeting}>MERHABA</Text>
            <Text style={hero.name}>{user?.name || 'Kullanıcı'}</Text>
          </View>
          {/* Bottom gradient fade into content bg */}
          <Svg height={90} width="100%" style={hero.fade} pointerEvents="none">
            <Defs>
              <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={C.bg} stopOpacity="0" />
                <Stop offset="1" stopColor={C.bg} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroFade)" />
          </Svg>
        </View>

        {/* ── Period Stats (Weekly/Monthly) ──────── */}
        {hasData && (
          <View style={styles.periodStatsSection}>
            <View style={styles.periodCard}>
              <Text style={styles.periodLabel}>Bu Hafta</Text>
              <Text style={styles.periodAmount}>{formatCurrency(stats.weeklyCost)}</Text>
            </View>
            <View style={styles.periodCard}>
              <Text style={styles.periodLabel}>Bu Ay</Text>
              <Text style={styles.periodAmount}>{formatCurrency(stats.monthlyCost)}</Text>
            </View>
          </View>
        )}

        {/* ── Total Stats Cards ─────────────────────── */}
        <View style={styles.statsSection}>
          {hasData ? (
            <View style={styles.statsRow}>
              {/* Toplam */}
              <View style={[styles.statCard, { borderColor: C.gold }]}>
                <View style={[styles.statIcon, { backgroundColor: C.goldSubtle }]}>
                  <Navigation size={16} color={C.gold} />
                </View>
                <Text style={[styles.statAmount, { color: C.gold }]}>
                  {formatCurrency(stats.totalCost)}
                </Text>
                <Text style={[styles.statLabel, { color: C.gold }]}>TOPLAM</Text>
              </View>

              {/* Yakıt */}
              <View style={[styles.statCard, { borderColor: C.fuel.PETROL }]}>
                <View style={[styles.statIcon, { backgroundColor: `${C.fuel.PETROL}18` }]}>
                  <Fuel size={16} color={C.fuel.PETROL} />
                </View>
                <Text style={[styles.statAmount, { color: C.fuel.PETROL }]}>
                  {formatCurrency(stats.totalFuelCost)}
                </Text>
                <Text style={[styles.statLabel, { color: C.fuel.PETROL }]}>YAKIT</Text>
              </View>

              {/* Gişe */}
              <View style={[styles.statCard, { borderColor: C.success }]}>
                <View style={[styles.statIcon, { backgroundColor: `${C.success}18` }]}>
                  <MapPin size={16} color={C.success} />
                </View>
                <Text style={[styles.statAmount, { color: C.success }]}>
                  {formatCurrency(stats.totalTollCost)}
                </Text>
                <Text style={[styles.statLabel, { color: C.success }]}>GİŞE</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Navigation size={40} color={C.textSoft} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>Henüz rota yok</Text>
              <Text style={styles.emptySubtitle}>İlk yolculuğunu hesapla</Text>
            </View>
          )}
        </View>

        {/* ── Recent Routes ─────────────────── */}
        {recentRoutes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Son Rotalar</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                <Text style={styles.seeAll}>Tümü</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.routeList}>
              {recentRoutes.map((route) => (
                <TouchableOpacity
                  key={route.id}
                  activeOpacity={0.7}
                  style={styles.routeCard}
                  onPress={() => router.push({ pathname: '/route/[id]', params: { id: route.id } })}
                >
                  <View style={styles.routeCardLeft}>
                    <Text style={styles.routeTitle} numberOfLines={1}>
                      {route.origin} → {route.destination}
                    </Text>
                    <Text style={styles.routeMeta}>
                      {formatDistance(route.distance)} · {formatDuration(route.duration)}
                    </Text>
                  </View>
                  <View style={styles.routeCardRight}>
                    <Text style={styles.routeCost}>{formatCurrency(route.totalCost)}</Text>
                    <ChevronRight size={16} color={C.textSoft} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── My Vehicles ───────────────────── */}
        {vehicles.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Araçlarım</Text>
              <TouchableOpacity onPress={() => router.push('/vehicles')}>
                <Text style={styles.seeAll}>Tümü</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vehiclesScroll}
            >
              {vehicles.map((v) => {
                const fuelColor = C.fuel[v.fuelType] || C.gold;
                return (
                  <TouchableOpacity
                    key={v.id}
                    activeOpacity={0.7}
                    style={styles.vehicleCard}
                    onPress={() => router.push({ pathname: '/vehicles/[id]', params: { id: v.id } })}
                  >
                    <View style={[styles.vehicleIcon, { backgroundColor: `${fuelColor}18` }]}>
                      <Car size={22} color={fuelColor} />
                    </View>
                    <Text style={styles.vehicleName} numberOfLines={1}>{v.name}</Text>
                    <Text style={[styles.vehicleFuel, { color: fuelColor }]}>{v.fuelType}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const hero = StyleSheet.create({
  mapHero: {
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  statusBarScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  textOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 80,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  androidHero: {
    backgroundColor: C.surface,
    paddingTop: 52,
    paddingHorizontal: 24,
    paddingBottom: 48,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  greeting: {
    fontSize: 11,
    fontWeight: '700',
    color: C.gold,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  name: {
    fontSize: 34,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: C.textSoft,
    marginTop: 6,
  },
});

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Stats
  periodStatsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: -28,
    marginBottom: 16,
    zIndex: 10,
  },
  periodCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  periodLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  periodAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
  },
  statsSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statAmount: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: C.text,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: C.textSoft,
  },

  // ── Empty
  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 14,
    color: C.textSoft,
    marginTop: 4,
  },

  // ── Sections
  section: {
    paddingHorizontal: 16,
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.4,
  },
  seeAll: {
    color: C.gold,
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Route list
  routeList: {
    gap: 10,
  },
  routeCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  routeCardLeft: {
    flex: 1,
    marginRight: 12,
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    marginBottom: 4,
  },
  routeMeta: {
    fontSize: 13,
    color: C.textSoft,
    fontWeight: '500',
  },
  routeCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeCost: {
    fontSize: 16,
    fontWeight: '800',
    color: C.gold,
    letterSpacing: -0.3,
  },

  // ── Vehicle scroll
  vehiclesScroll: {
    gap: 10,
    paddingBottom: 4,
  },
  vehicleCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    width: 120,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  vehicleName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  vehicleFuel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
