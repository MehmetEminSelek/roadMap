import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  View,
  Text,
  LayoutAnimation,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { MapPin, Car, Clock, Fuel, ChevronLeft, Heart, Trash2, Navigation } from 'lucide-react-native';
import { routeService } from '@/services/routeService';
import { historyService } from '@/services/historyService';
import type { Route } from '@/types/api';
import { C } from '@/theme';
import { buildStrokeColors, type RouteStep } from '@/utils/trafficColors';

const MAP_PROVIDER = PROVIDER_DEFAULT;

function decodePath(encoded: string): { latitude: number; longitude: number }[] {
  if (!encoded) return [];
  try {
    let str = encoded;
    if (str.startsWith('"') && str.endsWith('"')) str = str.slice(1, -1);
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'lat' in parsed[0]) {
      return parsed.map((p: any) => ({ latitude: p.lat, longitude: p.lng }));
    }
    return [];
  } catch {
    return [];
  }
}

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => { loadRoute(); }, [id]);

  // Parse routeSteps from backend (traffic-aware)
  const routeSteps: RouteStep[] = useMemo(() => {
    try {
      const stepsJson = (route as any)?.routeStepsJson;
      if (stepsJson && typeof stepsJson === 'string') {
        return JSON.parse(stepsJson);
      }
      if (stepsJson && Array.isArray(stepsJson)) {
        return stepsJson;
      }
    } catch {}
    return [];
  }, [route]);

  // Build traffic-aware polyline coords and colors
  const { coords: trafficCoords, colors: trafficColors } = useMemo(() => {
    if (routeSteps.length > 0) {
      return buildStrokeColors(routeSteps);
    }
    return { coords, colors: undefined as undefined | string[] };
  }, [routeSteps, coords]);

  // Parse alternatives from DB snapshot
  const alternatives = useMemo(() => {
    try {
      const raw = (route as any)?.alternativesJson;
      if (!raw) return [];
      if (typeof raw === 'string') return JSON.parse(raw);
      if (Array.isArray(raw)) return raw;
    } catch {}
    return [];
  }, [route]);

  // Unified route options
  const options = useMemo(() => {
    if (!route) return [] as any[];
    const primary = {
      label: 'Önerilen',
      summary: 'Önerilen rota',
      distance: route.distance,
      duration: route.duration,
      tollCost: Number(route.tollCost),
      fuelCost: Number(route.fuelCost),
      totalCost: Number(route.totalCost),
      tollDetails: route.tollDetails ?? [],
      coords,
    };
    const alts = alternatives.map((a: any, i: number) => ({
      label: `Alt. ${i + 1}`,
      summary: a.summary || `Alternatif ${i + 1}`,
      distance: a.distance,
      duration: a.duration,
      tollCost: Number(a.tollCost ?? 0),
      fuelCost: Number(a.fuelCost ?? 0),
      totalCost: Number(a.totalCost ?? 0),
      tollDetails: a.tollDetails ?? [],
      coords: Array.isArray(a.routeCoordinates)
        ? a.routeCoordinates.map((p: any) => ({ latitude: p.lat, longitude: p.lng }))
        : [],
    }));
    return [primary, ...alts];
  }, [route, alternatives, coords]);

  const selected = options[selectedIdx] ?? options[0];

  // Re-fit map when selection changes
  useEffect(() => {
    if (!selected || selected.coords.length < 2) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(selected.coords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    }, 150);
    return () => clearTimeout(t);
  }, [selectedIdx, selected?.coords.length]);

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
      <View style={[styles.fill, styles.centered]}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  if (error || !route) {
    return (
      <View style={[styles.fill, styles.centered]}>
        <Text style={styles.errText}>{error || 'Rota bulunamadı'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.errBtn}>
          <Text style={styles.errBtnText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {/* ── Header ─────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rota Detayı</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleAddFavorite} style={styles.iconBtn}>
            <Heart size={22} color={C.gold} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
            <Trash2 size={22} color={C.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Map Preview ────────────────────────── */}
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
              const fit = selected?.coords?.length ? selected.coords : coords;
              mapRef.current?.fitToCoordinates(fit, {
                edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                animated: false,
              });
            }}
          >
            {/* Non-selected alternatives — dim */}
            {options.map((opt, idx) => (
              idx !== selectedIdx && opt.coords.length > 1 ? (
                <Polyline
                  key={`alt-${idx}`}
                  coordinates={opt.coords}
                  strokeColor="rgba(142,142,147,0.55)"
                  strokeWidth={3}
                  zIndex={1}
                />
              ) : null
            ))}
            {/* Selected route highlighted */}
            {selected && selected.coords.length > 1 && (
              <Polyline
                coordinates={selectedIdx === 0 && trafficColors ? trafficCoords : selected.coords}
                strokeColors={selectedIdx === 0 ? trafficColors : undefined}
                strokeColor={selectedIdx === 0 && trafficColors ? undefined : '#0A84FF'}
                strokeWidth={5}
                zIndex={3}
              />
            )}
            <Marker coordinate={coords[0]}>
              <View style={[styles.dot, { backgroundColor: C.success }]} />
            </Marker>
            <Marker coordinate={coords[coords.length - 1]}>
              <View style={[styles.dot, { backgroundColor: C.danger }]} />
            </Marker>
          </MapView>
        )}

        {/* Route option selector — compact 1/2/3 chips right-aligned */}
        {options.length > 1 && (
          <View style={styles.chipRow}>
            <Text style={styles.chipHint}>Rota:</Text>
            {options.map((opt, idx) => {
              const isSel = idx === selectedIdx;
              return (
                <TouchableOpacity
                  key={`opt-${idx}`}
                  activeOpacity={0.8}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setSelectedIdx(idx);
                  }}
                  style={[styles.chip, isSel && styles.chipActive]}
                >
                  <Text style={[styles.chipText, isSel && styles.chipTextActive]}>{idx + 1}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {options.length > 1 && selected && (
          <Text style={styles.chipSummary} numberOfLines={1}>{selected.summary}</Text>
        )}

        <View style={styles.content}>
          {/* ── Origin → Destination ───────────── */}
          <View style={styles.card}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: C.success }]} />
              <Text style={styles.routeLocText} numberOfLines={1}>{route.origin}</Text>
            </View>
            <View style={styles.routeConnector}>
              <View style={styles.routeLine} />
            </View>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: C.danger }]} />
              <Text style={styles.routeLocText} numberOfLines={1}>{route.destination}</Text>
            </View>
          </View>

          {/* ── Cost Breakdown ─────────────────── */}
          <View style={styles.card}>
            <View style={styles.costRow}>
              {/* Gişe */}
              <View style={[styles.costBox, { borderLeftColor: C.success }]}>
                <Text style={[styles.costLabel, { color: C.success }]}>GİŞE</Text>
                <Text style={styles.costAmount}>{formatCurrency(selected?.tollCost ?? route.tollCost)}</Text>
              </View>
              {/* Yakıt */}
              <View style={[styles.costBox, { borderLeftColor: C.fuel.PETROL }]}>
                <Text style={[styles.costLabel, { color: C.fuel.PETROL }]}>YAKIT</Text>
                <Text style={styles.costAmount}>{formatCurrency(selected?.fuelCost ?? route.fuelCost)}</Text>
              </View>
            </View>
            {/* Total */}
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Toplam</Text>
              <Text style={styles.totalAmount}>{formatCurrency(selected?.totalCost ?? route.totalCost)}</Text>
            </View>
          </View>

          {/* ── Route Info Rows ────────────────── */}
          <View style={styles.card}>
            {[
              { icon: <Clock size={18} color={C.textSoft} />, label: 'Süre', value: formatDuration(selected?.duration ?? route.duration) },
              { icon: <Navigation size={18} color={C.textSoft} />, label: 'Mesafe', value: `${((selected?.distance ?? route.distance) / 1000).toFixed(1)} km` },
              ...(route.vehicle ? [
                { icon: <Car size={18} color={C.textSoft} />, label: 'Araç', value: route.vehicle.name },
                { icon: <Fuel size={18} color={C.textSoft} />, label: 'Yakıt Tipi', value: route.vehicle.fuelType },
              ] : []),
              { icon: <Clock size={18} color={C.textSoft} />, label: 'Tarih', value: formatDate(route.createdAt) },
            ].map((row, i, arr) => (
              <View
                key={row.label}
                style={[
                  styles.infoRow,
                  i < arr.length - 1 && styles.infoRowDivider,
                ]}
              >
                {row.icon}
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* ── Toll Details ───────────────────── */}
          {selected?.tollDetails && selected.tollDetails.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Gişe Detayları</Text>
              {selected.tollDetails.map((toll: any, i: number) => (
                <View
                  key={i}
                  style={[
                    styles.tollRow,
                    i < (selected.tollDetails?.length ?? 0) - 1 && styles.infoRowDivider,
                  ]}
                >
                  <View style={styles.tollLeft}>
                    <Text style={styles.tollName}>{toll.name}</Text>
                    <Text style={styles.tollHighway}>{toll.highway}</Text>
                  </View>
                  <Text style={styles.tollAmount}>{formatCurrency(toll.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: { padding: 8 },

  // ── Map
  map: { width: '100%', height: 220 },

  // ── Chip selector
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  chipHint: {
    fontSize: 13,
    color: C.textSoft,
    fontWeight: '500',
    marginRight: 4,
  },
  chip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: '#0A84FF',
    borderColor: '#0A84FF',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipSummary: {
    fontSize: 12,
    color: C.textSoft,
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingTop: 6,
  },

  // ── Content
  content: {
    padding: 16,
    gap: 12,
    flexDirection: 'column',
  },

  // ── Card
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },

  // ── Route location rows
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  routeLocText: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    flex: 1,
  },
  routeConnector: {
    paddingLeft: 5,
    paddingVertical: 4,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: C.border,
    marginLeft: 0.5,
  },

  // ── Cost breakdown
  costRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  costBox: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
  },
  costLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    color: C.gold,
  },
  costAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.4,
  },
  totalBox: {
    backgroundColor: C.goldSubtle,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,149,42,0.25)',
  },
  totalLabel: {
    color: C.goldLight,
    fontSize: 15,
    fontWeight: '600',
  },
  totalAmount: {
    color: C.gold,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // ── Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  infoRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.borderMuted,
  },
  infoLabel: {
    fontSize: 14,
    color: C.textSoft,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },

  // ── Toll details
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textSoft,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  tollRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  tollLeft: {
    flex: 1,
    marginRight: 12,
  },
  tollName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },
  tollHighway: {
    fontSize: 12,
    color: C.textSoft,
    marginTop: 2,
  },
  tollAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: C.gold,
  },

  // ── Marker dot
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
  },

  // ── Error state
  errText: {
    fontSize: 16,
    color: C.danger,
    marginBottom: 16,
  },
  errBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  errBtnText: {
    color: C.text,
    fontWeight: '600',
  },
});
