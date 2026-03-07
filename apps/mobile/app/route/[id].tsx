import { useState, useEffect, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  YStack,
  XStack,
  Card,
  Text,
} from 'tamagui';
import { MapPin, Car, Clock, Fuel, ChevronLeft, Heart, Trash2, Navigation } from 'lucide-react-native';
import { routeService } from '@/services/routeService';
import { historyService } from '@/services/historyService';
import type { Route } from '@/types/api';

const MAP_PROVIDER = Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE;

function decodePath(encoded: string): { latitude: number; longitude: number }[] {
  if (!encoded) return [];
  try {
    let str = encoded;
    if (str.startsWith('"') && str.endsWith('"')) str = str.slice(1, -1);
    let index = 0, lat = 0, lng = 0;
    const coords: { latitude: number; longitude: number }[] = [];
    while (index < str.length) {
      let b, shift = 0, result = 0;
      do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
      shift = 0; result = 0;
      do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
      coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return coords;
  } catch {
    return [];
  }
}

function getGradientColors(count: number): string[] {
  if (count === 0) return [];
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  const [sR, sG, sB] = [52, 199, 89];
  const [eR, eG, eB] = [255, 45, 85];
  return Array.from({ length: count }, (_, i) => {
    const t = i / Math.max(count - 1, 1);
    return `#${toHex(sR + (eR - sR) * t)}${toHex(sG + (eG - sG) * t)}${toHex(sB + (eB - sB) * t)}`;
  });
}

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);

  useEffect(() => { loadRoute(); }, [id]);

  const loadRoute = async () => {
    try {
      const data = await routeService.getOne(id as string);
      setRoute(data);
      if (data.routeCoordinates) {
        setCoords(decodePath(data.routeCoordinates));
      }
    } catch (err: any) {
      setError(err.message || 'Rota bulunamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFavorite = async () => {
    if (!route) return;
    try {
      await historyService.addFavorite(route.id, `${route.origin} → ${route.destination}`);
      Alert.alert('Başarılı', 'Favorilere eklendi!');
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  };

  const handleDelete = () => {
    Alert.alert('Rotayı Sil', 'Bu rotayı silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await routeService.delete(id as string);
            router.back();
          } catch (err: any) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const formatCurrency = (amount: number) =>
    Number(amount).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h === 0 ? `${m} dk` : `${h} saat ${m} dk`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  if (loading) {
    return (
      <YStack flex={1} backgroundColor="#F2F2F7" justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" color="#1C1C1E" />
      </YStack>
    );
  }

  if (error || !route) {
    return (
      <YStack flex={1} backgroundColor="#F2F2F7" justifyContent="center" alignItems="center" gap={16}>
        <Text fontSize={16} color="#FF3B30">{error || 'Rota bulunamadı'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.errBtn}>
          <Text color="white" fontWeight="600">Geri Dön</Text>
        </TouchableOpacity>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="#F2F2F7">
      {/* Header */}
      <XStack
        backgroundColor="white"
        paddingTop={insets.top + 8}
        paddingBottom={12}
        paddingHorizontal={16}
        justifyContent="space-between"
        alignItems="center"
        borderBottomWidth={1}
        borderBottomColor="#F0F0F0"
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text fontSize={17} fontWeight="700" color="#1C1C1E">Rota Detayı</Text>
        <XStack gap={8}>
          <TouchableOpacity onPress={handleAddFavorite} style={styles.iconBtn}>
            <Heart size={22} color="#FF3B30" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
            <Trash2 size={22} color="#8E8E93" />
          </TouchableOpacity>
        </XStack>
      </XStack>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Map Preview */}
        {coords.length > 0 && (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={MAP_PROVIDER}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            onMapReady={() => {
              mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                animated: false,
              });
            }}
          >
            <Polyline
              coordinates={coords}
              strokeColors={getGradientColors(coords.length)}
              strokeWidth={4}
            />
            <Marker coordinate={coords[0]}>
              <YStack width={14} height={14} borderRadius={7} backgroundColor="#34C759" borderWidth={2} borderColor="white" />
            </Marker>
            <Marker coordinate={coords[coords.length - 1]}>
              <YStack width={14} height={14} borderRadius={7} backgroundColor="#FF2D55" borderWidth={2} borderColor="white" />
            </Marker>
          </MapView>
        )}

        <YStack padding={16} gap={12}>
          {/* Origin → Destination */}
          <Card backgroundColor="white" borderRadius={16} padding={20} elevate>
            <XStack alignItems="center" gap={12}>
              <MapPin size={20} color="#34C759" />
              <Text fontSize={16} fontWeight="600" color="#1C1C1E" flex={1}>{route.origin}</Text>
            </XStack>
            <YStack width={2} height={20} backgroundColor="#E5E7EB" marginLeft={9} marginVertical={4} />
            <XStack alignItems="center" gap={12}>
              <MapPin size={20} color="#FF2D55" />
              <Text fontSize={16} fontWeight="600" color="#1C1C1E" flex={1}>{route.destination}</Text>
            </XStack>
          </Card>

          {/* Cost Breakdown */}
          <Card backgroundColor="white" borderRadius={16} padding={20} elevate>
            <XStack gap={10} marginBottom={14}>
              <YStack flex={1} backgroundColor="#F0FFF4" padding={14} borderRadius={12}>
                <Text fontSize={11} color="#22C55E" fontWeight="600" letterSpacing={0.5} marginBottom={4}>GİŞE</Text>
                <Text fontSize={18} fontWeight="800" color="#14532D">{formatCurrency(route.tollCost)}</Text>
              </YStack>
              <YStack flex={1} backgroundColor="#FFF7ED" padding={14} borderRadius={12}>
                <Text fontSize={11} color="#F97316" fontWeight="600" letterSpacing={0.5} marginBottom={4}>YAKIT</Text>
                <Text fontSize={18} fontWeight="800" color="#7C2D12">{formatCurrency(route.fuelCost)}</Text>
              </YStack>
            </XStack>
            <XStack
              backgroundColor="#1C1C1E"
              padding={16}
              borderRadius={12}
              justifyContent="space-between"
              alignItems="center"
            >
              <Text color="rgba(255,255,255,0.7)" fontSize={15}>Toplam</Text>
              <Text color="white" fontSize={22} fontWeight="800" letterSpacing={-0.5}>
                {formatCurrency(route.totalCost)}
              </Text>
            </XStack>
          </Card>

          {/* Route Info */}
          <Card backgroundColor="white" borderRadius={16} padding={20} elevate>
            {[
              { icon: <Clock size={18} color="#8E8E93" />, label: 'Süre', value: formatDuration(route.duration) },
              { icon: <Navigation size={18} color="#8E8E93" />, label: 'Mesafe', value: `${(route.distance / 1000).toFixed(1)} km` },
              ...(route.vehicle ? [
                { icon: <Car size={18} color="#8E8E93" />, label: 'Araç', value: route.vehicle.name },
                { icon: <Fuel size={18} color="#8E8E93" />, label: 'Yakıt Tipi', value: route.vehicle.fuelType },
              ] : []),
              { icon: <Clock size={18} color="#8E8E93" />, label: 'Tarih', value: formatDate(route.createdAt) },
            ].map((row, i, arr) => (
              <XStack
                key={row.label}
                alignItems="center"
                gap={12}
                paddingVertical={10}
                borderBottomWidth={i < arr.length - 1 ? 1 : 0}
                borderBottomColor="#F0F0F0"
              >
                {row.icon}
                <Text fontSize={14} color="#8E8E93" flex={1}>{row.label}</Text>
                <Text fontSize={14} fontWeight="600" color="#1C1C1E">{row.value}</Text>
              </XStack>
            ))}
          </Card>

          {/* Toll Details */}
          {route.tollDetails && route.tollDetails.length > 0 && (
            <Card backgroundColor="white" borderRadius={16} padding={20} elevate>
              <Text fontSize={15} fontWeight="700" color="#1C1C1E" marginBottom={12}>Gişe Detayları</Text>
              {route.tollDetails.map((toll, i) => (
                <XStack
                  key={i}
                  justifyContent="space-between"
                  alignItems="center"
                  paddingVertical={8}
                  borderBottomWidth={i < (route.tollDetails?.length ?? 0) - 1 ? 1 : 0}
                  borderBottomColor="#F0F0F0"
                >
                  <YStack flex={1} marginRight={8}>
                    <Text fontSize={13} fontWeight="600" color="#1C1C1E">{toll.name}</Text>
                    <Text fontSize={12} color="#9CA3AF">{toll.highway}</Text>
                  </YStack>
                  <Text fontSize={14} fontWeight="700" color="#1C1C1E">
                    {formatCurrency(toll.amount)}
                  </Text>
                </XStack>
              ))}
            </Card>
          )}
        </YStack>

        <YStack height={insets.bottom + 20} />
      </ScrollView>
    </YStack>
  );
}

const styles = StyleSheet.create({
  iconBtn: { padding: 8 },
  map: { width: '100%', height: 220 },
  errBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#1C1C1E', borderRadius: 12 },
});
