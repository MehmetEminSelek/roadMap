import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions, LayoutAnimation, Platform, UIManager, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin, Car, Clock, Fuel, ChevronLeft, Heart, Navigation, ChevronDown, ChevronUp, Coffee, X, Star } from 'lucide-react-native';
import MapView, { Marker, Polyline, Callout, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { routeService } from '@/services/routeService';
import { historyService } from '@/services/historyService';
import type { Route, NearbyRestArea } from '@/types/api';
import { buildStrokeColors, decodePolyline, type RouteStep } from '@/utils/trafficColors';

const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAP_PROVIDER = PROVIDER_DEFAULT;

export default function ResultsScreen() {
  const params = useLocalSearchParams();
  const mapRef = useRef<MapView | null>(null);
  const previewMapRef = useRef<MapView | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [tollExpanded, setTollExpanded] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [decodedCoords, setDecodedCoords] = useState<{ latitude: number, longitude: number }[]>([]);
  const [animatedCoords, setAnimatedCoords] = useState<{ latitude: number, longitude: number }[]>([]);
  const [stopSuggestions, setStopSuggestions] = useState<any[]>([]);
  const [nearbyRestAreas, setNearbyRestAreas] = useState<NearbyRestArea[]>([]);
  const [alternatives, setAlternatives] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    loadResult();
  }, [params.routeId]);

  useEffect(() => {
    if (decodedCoords.length === 0) return;
    setAnimatedCoords([]);
    const TOTAL_FRAMES = 40;
    const STEP = Math.max(1, Math.ceil(decodedCoords.length / TOTAL_FRAMES));
    let frame = 0;
    const animate = () => {
      frame++;
      const end = Math.min(frame * STEP, decodedCoords.length);
      setAnimatedCoords(decodedCoords.slice(0, end));
      if (end < decodedCoords.length) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [decodedCoords]);

  // Auto-fit preview map to show complete route
  useEffect(() => {
    if (animatedCoords.length === decodedCoords.length && decodedCoords.length > 1) {
      setTimeout(() => {
        previewMapRef.current?.fitToCoordinates(decodedCoords, {
          edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
          animated: false,
        });
      }, 300);
    }
  }, [animatedCoords.length, decodedCoords.length]);

  const loadResult = async () => {
    const routeId = params.routeId as string;
    if (routeId) {
      try {
        const data = await routeService.getOne(routeId);
        if (data) {
          setRoute(data);
          if (data.routeCoordinates) {
            decodePath(data.routeCoordinates);
          }
        } else {
          const fallback = buildRouteFromParams();
          setRoute(fallback);
          if (fallback.routeCoordinates) {
            decodePath(fallback.routeCoordinates);
          }
        }
      } catch (error) {
        console.error('Error loading route:', error);
        const fallback = buildRouteFromParams();
        setRoute(fallback);
        if (fallback.routeCoordinates) {
          decodePath(fallback.routeCoordinates);
        }
      }
    } else {
      const fallback = buildRouteFromParams();
      setRoute(fallback);
      if (fallback.routeCoordinates) {
        decodePath(fallback.routeCoordinates);
      }
    }

    // Parse stop suggestions if passed via params
    if (params.stops) {
      try {
        setStopSuggestions(JSON.parse(params.stops as string));
      } catch (e) { }
    }

    // Parse nearby rest areas if passed via params
    if (params.nearbyRestAreas) {
      try {
        setNearbyRestAreas(JSON.parse(params.nearbyRestAreas as string));
      } catch (e) { }
    }

    // Parse alternatives if passed via params
    if (params.alternatives) {
      try {
        setAlternatives(JSON.parse(params.alternatives as string));
      } catch (e) { }
    }

    setLoading(false);
  };

  const buildRouteFromParams = (): Route => {
    let parsedTollDetails: any = null;
    try {
      if (params.tollDetails) {
        parsedTollDetails = JSON.parse(params.tollDetails as string);
      }
    } catch (e) {
      console.error('Failed to parse tollDetails', e);
    }

    return {
      id: '',
      userId: '',
      origin: (params.origin as string) || '',
      destination: (params.destination as string) || '',
      originLat: 0,
      originLng: 0,
      destLat: 0,
      destLng: 0,
      distance: parseInt(params.distance as string) || 0,
      duration: parseInt(params.duration as string) || 0,
      tollCost: parseFloat(params.tollCost as string) || 0,
      tollDetails: parsedTollDetails,
      fuelCost: parseFloat(params.fuelCost as string) || 0,
      totalCost: parseFloat(params.totalCost as string) || 0,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      routeCoordinates: params.routeCoordinates ? (typeof params.routeCoordinates === 'string' && params.routeCoordinates.startsWith('"') ? JSON.parse(params.routeCoordinates) : params.routeCoordinates as string) : undefined,
    };
  };

  const decodePath = (encoded: string) => {
    if (!encoded) return;
    try {
      let str = encoded;
      // Remove surrounding quotes if present (JSON string format)
      if (str.startsWith('"') && str.endsWith('"')) {
        str = str.substring(1, str.length - 1);
      }

      // Parse as JSON array: [{lat, lng}, ...]
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'lat' in parsed[0]) {
        setDecodedCoords(parsed.map((p: any) => ({
          latitude: p.lat,
          longitude: p.lng,
        })));
      }
    } catch (e) {
      console.error("Polyline decoding failed", e);
    }
  };

  const handleSaveFavorite = async () => {
    if (!route?.id) return;
    try {
      await historyService.addFavorite(route.id, `${route.origin} → ${route.destination}`);
      Alert.alert('Başarılı', 'Favorilere eklendi!');
    } catch (err: any) {
      Alert.alert('Bilgi', 'Bu rota zaten favorilerinizde.');
    }
  };

  const formatCurrency = (amount: number) => {
    return `₺${Number(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,').replace(',', '#').replace('.', ',').replace('#', '.')}`;
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return (params.duration as string) || '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours === 0) return `${minutes} dk`;
    return `${hours} sa ${minutes} dk`;
  };

  const formatDistance = (meters: number): string => {
    if (!meters) return (params.distance as string) || '-';
    return `${(meters / 1000).toFixed(1)} km`;
  };

  // Parse routeSteps from backend (traffic-aware)
  const routeSteps: RouteStep[] = useMemo(() => {
    try {
      const stepsJson = (route as any).routeStepsJson;
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
    // Fallback: use decodedCoords with neutral blue
    return { coords: decodedCoords, colors: undefined as undefined | string[] };
  }, [routeSteps, decodedCoords]);

  // Unified route options: primary + alternatives
  const options = useMemo(() => {
    if (!route) return [] as any[];
    const primary = {
      label: 'Önerilen',
      summary: (route as any).summary || 'Önerilen rota',
      distance: route.distance,
      duration: route.duration,
      tollCost: route.tollCost,
      fuelCost: route.fuelCost,
      totalCost: route.totalCost,
      tollDetails: route.tollDetails ?? [],
      coords: decodedCoords,
    };
    const alts = alternatives.map((a, i) => ({
      label: `Alt. ${i + 1}`,
      summary: a.summary || `Alternatif ${i + 1}`,
      distance: a.distance,
      duration: a.duration,
      tollCost: a.tollCost,
      fuelCost: a.fuelCost,
      totalCost: a.totalCost,
      tollDetails: a.tollDetails ?? [],
      coords: Array.isArray(a.routeCoordinates)
        ? a.routeCoordinates.map((p: any) => ({ latitude: p.lat, longitude: p.lng }))
        : [],
    }));
    return [primary, ...alts];
  }, [route, decodedCoords, alternatives]);

  const selected = options[selectedIdx] ?? options[0];

  // Re-fit both maps when selection changes
  useEffect(() => {
    if (!selected || selected.coords.length < 2) return;
    const t = setTimeout(() => {
      previewMapRef.current?.fitToCoordinates(selected.coords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
      if (mapExpanded) {
        mapRef.current?.fitToCoordinates(selected.coords, {
          edgePadding: { top: 100, right: 50, bottom: 250, left: 50 },
          animated: true,
        });
      }
    }, 150);
    return () => clearTimeout(t);
  }, [selectedIdx, selected?.coords.length, mapExpanded]);

  // Filter toll markers with bbox safety (Turkey bounds) — follows selection
  const validTolls = useMemo(
    () => (selected?.tollDetails ?? []).filter((t: any) =>
      typeof t.lat === 'number' && typeof t.lng === 'number' &&
      t.lat > 35 && t.lat < 43 &&      // Türkiye kabaca
      t.lng > 25 && t.lng < 45
    ),
    [selected?.tollDetails],
  );

  if (loading || !route) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#0A84FF" />
        <Text style={styles.loadingText}>Sonuçlar hazırlanıyor...</Text>
      </View>
    );
  }

  const vehicleName = (params.vehicleName as string) || (route as any).vehicle?.name || 'Belirtilmedi';
  const fuelType = (params.fuelType as string) || (route as any).vehicle?.fuelType || '';

  const toggleTollExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTollExpanded(!tollExpanded);
  };

  return (
    <View style={styles.container}>
      {/* Sleek Header Section */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <ChevronLeft size={28} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yolculuk Özeti</Text>
        <TouchableOpacity style={styles.iconButton} onPress={handleSaveFavorite}>
          <Heart size={24} color="#FF2D55" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Main Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.routeHeader}>
            <View style={styles.routeDot} />
            <Text style={styles.routeName} numberOfLines={1}>{route.origin}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeHeader}>
            <View style={[styles.routeDot, { backgroundColor: '#0A84FF' }]} />
            <Text style={styles.routeName} numberOfLines={1}>{route.destination}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.totalLabel}>Toplam Tahmini Maliyet</Text>
          <Text style={styles.totalValue}>{formatCurrency(selected?.totalCost ?? route.totalCost)}</Text>
        </View>

        {/* Map Preview Widget (8x4 aspect ratio approximately) */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => setMapExpanded(true)} style={styles.mapPreviewContainer}>
          <View pointerEvents="none" style={styles.mapPreviewWrapper}>
            <MapView
              ref={previewMapRef}
              style={styles.mapPreview}
              provider={MAP_PROVIDER}
              initialRegion={
                route.originLat ? {
                  latitude: (route.originLat + route.destLat) / 2,
                  longitude: (route.originLng + route.destLng) / 2,
                  latitudeDelta: Math.abs(route.originLat - route.destLat) * 1.5 || 2,
                  longitudeDelta: Math.abs(route.originLng - route.destLng) * 1.5 || 2,
                } : undefined
              }
              onMapReady={() => {
                if (decodedCoords.length > 1) {
                  previewMapRef.current?.fitToCoordinates(decodedCoords, {
                    edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                    animated: false,
                  });
                }
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              showsUserLocation
            >
              {/* Non-selected alternatives — dim */}
              {options.map((opt, idx) => (
                idx !== selectedIdx && opt.coords.length > 1 ? (
                  <Polyline
                    key={`preview-alt-${idx}`}
                    coordinates={opt.coords}
                    strokeColor="rgba(142,142,147,0.55)"
                    strokeWidth={3}
                    zIndex={1}
                  />
                ) : null
              ))}
              {/* Selected route — highlight (traffic colors if primary) */}
              {selected && selected.coords.length > 1 && (
                <Polyline
                  coordinates={selectedIdx === 0 && trafficColors ? trafficCoords : selected.coords}
                  strokeColors={selectedIdx === 0 ? trafficColors : undefined}
                  strokeColor={selectedIdx === 0 && trafficColors ? undefined : '#0A84FF'}
                  strokeWidth={5}
                  zIndex={3}
                />
              )}

              {/* Origin & Destination Markers */}
              {route.originLat && route.originLng && (
                <Marker coordinate={{ latitude: route.originLat, longitude: route.originLng }}>
                  <View style={[styles.mapMarker, { backgroundColor: '#34C759' }]} />
                </Marker>
              )}
              {route.destLat && route.destLng && (
                <Marker coordinate={{ latitude: route.destLat, longitude: route.destLng }}>
                  <View style={[styles.mapMarker, { backgroundColor: '#FF2D55' }]} />
                </Marker>
              )}

              {/* Toll Gate Markers (bbox-filtered) */}
              {validTolls.map((toll, idx) => (
                <Marker key={`toll-preview-${idx}`} coordinate={{ latitude: toll.lat, longitude: toll.lng }}>
                  <View style={styles.tollMarker}>
                    <Text style={styles.tollMarkerText}>₺</Text>
                  </View>
                </Marker>
              ))}

              {/* Stop Suggestions */}
              {stopSuggestions.map((stop, idx) => (
                <Marker key={`stop-${idx}`} coordinate={{ latitude: stop.lat, longitude: stop.lng }}>
                  <View style={styles.stopMarker}>
                    <Coffee size={12} color="#FFFFFF" />
                  </View>
                </Marker>
              ))}
            </MapView>
          </View>
          {stopSuggestions.length > 0 && (
            <View style={styles.stopBanner}>
              <Coffee size={14} color="#0A84FF" style={{ marginRight: 6 }} />
              <Text style={styles.stopBannerText}>{stopSuggestions.length} Mola Önerisi</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Route Option Selector — compact 1/2/3 chips, right-aligned */}
        {options.length > 1 && (
          <View style={styles.optionChipRow}>
            <Text style={styles.optionChipHint}>Rota:</Text>
            {options.map((opt, idx) => {
              const isSelected = idx === selectedIdx;
              return (
                <TouchableOpacity
                  key={`opt-${idx}`}
                  activeOpacity={0.8}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setSelectedIdx(idx);
                  }}
                  style={[styles.optionChip, isSelected && styles.optionChipActive]}
                >
                  <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive]}>
                    {idx + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Selected route summary label */}
        {options.length > 1 && selected && (
          <Text style={styles.selectedSummary} numberOfLines={1}>
            {selected.summary}
          </Text>
        )}

        {/* Cost Breakdown List (Row Style) */}
        <Text style={styles.sectionTitle}>Maliyet Dağılımı</Text>
        <View style={styles.costRowsContainer}>
          {/* Fuel Row */}
          <View style={styles.costRow}>
            <View style={styles.costRowLeft}>
              <View style={[styles.costIconBox, styles.blueBg]}>
                <Fuel size={20} color="#0A84FF" />
              </View>
              <Text style={styles.costRowLabel}>Yakıt</Text>
            </View>
            <Text style={styles.costRowValue}>{formatCurrency(selected?.fuelCost ?? route.fuelCost)}</Text>
          </View>

          <View style={styles.costDivider} />

          {/* Toll Row (Expandable) */}
          <TouchableOpacity style={styles.costRow} activeOpacity={0.7} onPress={toggleTollExpanded}>
            <View style={styles.costRowLeft}>
              <View style={[styles.costIconBox, styles.orangeBg]}>
                <MapPin size={20} color="#FF9500" />
              </View>
              <Text style={styles.costRowLabel}>Gişe & Köprü</Text>
              {(selected?.tollDetails && selected.tollDetails.length > 0) && (
                tollExpanded ? <ChevronUp size={20} color="#8E8E93" style={{ marginLeft: 6 }} /> : <ChevronDown size={20} color="#8E8E93" style={{ marginLeft: 6 }} />
              )}
            </View>
            <Text style={styles.costRowValue}>{formatCurrency(selected?.tollCost ?? route.tollCost)}</Text>
          </TouchableOpacity>

          {/* Expanded Toll Details */}
          {tollExpanded && selected?.tollDetails && selected.tollDetails.length > 0 && (
            <View style={styles.tollDetailsContainer}>
              {selected.tollDetails.map((toll: any, idx: number) => (
                <View key={idx} style={styles.tollDetailItem}>
                  <View style={styles.tollDetailLeft}>
                    <Text style={styles.tollDetailName}>{toll.name}</Text>
                    <Text style={styles.tollDetailHighway}>{toll.highway}</Text>
                  </View>
                  <Text style={styles.tollDetailAmount}>{formatCurrency(toll.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Trip Details List */}
        <Text style={styles.sectionTitle}>Yolculuk Detayları</Text>
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}>
              <Clock size={20} color="#8E8E93" />
            </View>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailTitle}>Tahmini Süre</Text>
              <Text style={styles.detailSubtitle}>{formatDuration(selected?.duration ?? route.duration)}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}>
              <Navigation size={20} color="#8E8E93" />
            </View>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailTitle}>Mesafe</Text>
              <Text style={styles.detailSubtitle}>{formatDistance(selected?.distance ?? route.distance)}</Text>
            </View>
          </View>

          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <View style={styles.detailIconBox}>
              <Car size={20} color="#8E8E93" />
            </View>
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailTitle}>Araç Profili</Text>
              <Text style={styles.detailSubtitle}>{vehicleName} {fuelType ? `• ${fuelType}` : ''}</Text>
            </View>
          </View>
        </View>

        {/* Bottom padding for scrolling */}
        <View style={{ height: 200 }} />
      </ScrollView>

      {/* Floating Action Button — outside ScrollView so it truly floats */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={() => router.push('/(tabs)/calculate')}>
          <Text style={styles.primaryButtonText}>Yeni Rota Hesapla</Text>
        </TouchableOpacity>
      </View>

      {/* Fullscreen Interactive Map Modal */}
      <Modal visible={mapExpanded} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMapExpanded(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeModalBtn} onPress={() => setMapExpanded(false)} activeOpacity={0.7}>
            <View style={styles.closeModalIconBg}>
              <X size={20} color="#1C1C1E" />
            </View>
          </TouchableOpacity>

          <MapView
            ref={mapRef}
            style={styles.fullMap}
            provider={MAP_PROVIDER}
            showsUserLocation
            onMapReady={() => {
              const fitCoords = selected?.coords?.length ? selected.coords : decodedCoords;
              if (fitCoords.length > 0) {
                mapRef.current?.fitToCoordinates(fitCoords, {
                  edgePadding: { top: 100, right: 50, bottom: 250, left: 50 },
                  animated: true,
                });
              }
            }}
          >
            {/* Non-selected alternatives — dim */}
            {options.map((opt, idx) => (
              idx !== selectedIdx && opt.coords.length > 1 ? (
                <Polyline
                  key={`modal-alt-${idx}`}
                  coordinates={opt.coords}
                  strokeColor="rgba(142,142,147,0.55)"
                  strokeWidth={3}
                  zIndex={1}
                />
              ) : null
            ))}
            {/* Selected route — highlight */}
            {selected && selected.coords.length > 1 && (
              <Polyline
                coordinates={selectedIdx === 0 && trafficColors ? trafficCoords : selected.coords}
                strokeColors={selectedIdx === 0 ? trafficColors : undefined}
                strokeColor={selectedIdx === 0 && trafficColors ? undefined : '#0A84FF'}
                strokeWidth={5}
                zIndex={3}
              />
            )}
            {route.originLat && route.originLng && (
              <Marker coordinate={{ latitude: route.originLat, longitude: route.originLng }}>
                <View style={[styles.mapMarker, { backgroundColor: '#34C759' }]} />
              </Marker>
            )}
            {route.destLat && route.destLng && (
              <Marker coordinate={{ latitude: route.destLat, longitude: route.destLng }}>
                <View style={[styles.mapMarker, { backgroundColor: '#FF2D55' }]} />
              </Marker>
            )}

            {/* Toll Gate Markers with Labels (bbox-filtered) */}
            {validTolls.map((toll, idx) => (
              <Marker key={`modal-toll-${idx}`} coordinate={{ latitude: toll.lat, longitude: toll.lng }}>
                <View style={styles.tollMarkerLarge}>
                  <Text style={styles.tollMarkerTextLarge}>₺</Text>
                </View>
                <Callout tooltip={false}>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>{toll.name}</Text>
                    <Text style={styles.calloutSubtitle}>{toll.highway} • ₺{toll.amount}</Text>
                  </View>
                </Callout>
              </Marker>
            ))}

            {/* Selected Stop Suggestions */}
            {stopSuggestions.map((stop, idx) => (
              <Marker key={`modal-stop-${idx}`} coordinate={{ latitude: stop.lat, longitude: stop.lng }}>
                <View style={styles.stopMarker}>
                  <Coffee size={14} color="#FFFFFF" />
                </View>
                <Callout tooltip={false}>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>{stop.name}</Text>
                    {stop.rating && <Text style={styles.calloutSubtitle}>⭐ {stop.rating.toFixed(1)}</Text>}
                  </View>
                </Callout>
              </Marker>
            ))}

            {/* Nearby Rest Areas (small markers with names) */}
            {nearbyRestAreas.map((area, idx) => (
              <Marker
                key={`rest-${idx}`}
                coordinate={{ latitude: area.lat, longitude: area.lng }}
                tracksViewChanges={false}
              >
                <View style={styles.restAreaMarker}>
                  <Fuel size={10} color="#6B7280" />
                </View>
                <Callout tooltip={false}>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>{area.name}</Text>
                    {area.rating && <Text style={styles.calloutSubtitle}>⭐ {area.rating.toFixed(1)}</Text>}
                    {area.vicinity && <Text style={styles.calloutSubtitle} numberOfLines={1}>{area.vicinity}</Text>}
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>

          {stopSuggestions.length > 0 && (
            <View style={styles.stopsModalBottom}>
              <View style={styles.stopsModalHeader}>
                <Coffee size={20} color="#FF9500" />
                <Text style={styles.stopsModalTitle}>Dinlenme Tesisleri</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stopsHorizontalList}>
                {stopSuggestions.map((stop, idx) => (
                  <View key={`sheet-stop-${idx}`} style={styles.stopCardItem}>
                    <Text style={styles.stopCardName} numberOfLines={1}>{stop.name}</Text>
                    <View style={styles.stopCardMeta}>
                      <MapPin size={12} color="#8E8E93" />
                      <Text style={styles.stopCardAddress} numberOfLines={1}>{stop.location}</Text>
                    </View>
                    {stop.rating && (
                      <View style={styles.stopCardRating}>
                        <Star size={12} color="#FF9500" fill="#FF9500" />
                        <Text style={styles.stopCardRatingText}>{stop.rating.toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7', // Apple standard light-gray background
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    marginRight: 16,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E5E5EA',
    marginLeft: 5,
    marginVertical: 4,
  },
  routeName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginVertical: 24,
  },
  totalLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  mapPreviewContainer: {
    height: 180, // roughly 8x4 aspect relative to width
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#E5E5EA', // Grey placeholder color
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  mapPreviewWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPreview: {
    width: '100%',
    height: '100%',
  },
  mapMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  stopMarker: {
    width: 24,
    height: 24,
    backgroundColor: '#FF9500',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBanner: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  stopBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0A84FF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  closeModalBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
  },
  closeModalIconBg: {
    backgroundColor: '#FFFFFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  fullMap: {
    flex: 1,
  },
  stopsModalBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 10,
  },
  stopsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  stopsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginLeft: 8,
  },
  stopsHorizontalList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  stopCardItem: {
    width: 200,
    backgroundColor: '#FAFAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  stopCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  stopCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stopCardAddress: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
    flex: 1,
  },
  stopCardRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stopCardRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF9500',
    marginLeft: 4,
  },
  costRowsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
    overflow: 'hidden',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  costRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  costIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  costRowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  costRowValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  costDivider: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginLeft: 72,
  },
  tollDetailsContainer: {
    backgroundColor: '#FAFAFC',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  tollDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tollDetailLeft: {
    flex: 1,
    paddingRight: 16,
  },
  tollDetailName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  tollDetailHighway: {
    fontSize: 12,
    color: '#8E8E93',
  },
  tollDetailAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  blueBg: {
    backgroundColor: '#F0F8FF',
  },
  orangeBg: {
    backgroundColor: '#FFF5EB',
  },
  detailsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  detailIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 2,
  },
  detailSubtitle: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    right: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryButton: {
    backgroundColor: '#0A84FF',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  // Toll gate markers
  tollMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF9500',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  tollMarkerText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tollMarkerLarge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF9500',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  tollMarkerTextLarge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Rest area markers (small, subtle)
  restAreaMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Callout styles
  calloutContainer: {
    minWidth: 120,
    maxWidth: 200,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  calloutSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '400',
  },
  // Compact 1/2/3 chip selector, right-aligned beneath the map
  optionChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  optionChipHint: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    marginRight: 4,
  },
  optionChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  optionChipActive: {
    backgroundColor: '#0A84FF',
    borderColor: '#0A84FF',
    shadowColor: '#0A84FF',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  optionChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  optionChipTextActive: {
    color: '#FFFFFF',
  },
  selectedSummary: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'right',
    marginBottom: 24,
    paddingHorizontal: 2,
  },
  // Alternatives (legacy — kept for backward compatibility)
  alternativesContainer: {
    paddingBottom: 24,
    gap: 16,
  },
  alternativeCard: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  alternativeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  alternativeDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alternativeDetailText: {
    fontSize: 14,
    color: '#3A3A3C',
    marginLeft: 8,
    fontWeight: '500',
    flex: 1,
  },
  diffBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  alternativeCostBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  alternativeCostValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
});
