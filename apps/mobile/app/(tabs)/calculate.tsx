import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { YStack, XStack, Text, Card } from 'tamagui';
import { ArrowUpDown, ChevronRight, CheckCircle2, Car } from 'lucide-react-native';
import { vehicleService } from '@/services/vehicleService';
import { routeService } from '@/services/routeService';
import type { Vehicle } from '@/types/api';
import { useAutocomplete } from '@/queries/autocomplete';
import { SuggestionRow } from '@/components/SuggestionRow';
import { useUserLocation } from '@/hooks/useUserLocation';

const MAP_PROVIDER = PROVIDER_DEFAULT;

const TURKEY_REGION = {
  latitude: 39.0,
  longitude: 35.0,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

export default function CalculateScreen() {
  const insets = useSafeAreaInsets();
  const { location: userLocation } = useUserLocation();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [vehiclePanelOpen, setVehiclePanelOpen] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [activeField, setActiveField] = useState<'origin' | 'destination' | null>(null);
  const [debouncedInput, setDebouncedInput] = useState('');
  const inputRef = useRef<string>('');

  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // Debounce input for autocomplete query
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (inputRef.current.length >= 2) {
        setDebouncedInput(inputRef.current);
      } else {
        setDebouncedInput('');
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [origin, destination, activeField]);

  const { data: suggestions = [], isLoading } = useAutocomplete(debouncedInput);

  useEffect(() => {
    if (calculating) {
      spinRef.current = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })
      );
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      spinRef.current.start();
      pulseRef.current.start();
    } else {
      spinRef.current?.stop();
      pulseRef.current?.stop();
      spinAnim.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [calculating]);

  useFocusEffect(
    useCallback(() => {
      vehicleService.getAll().then(setVehicles).catch(() => {});
    }, [])
  );

  const swap = () => {
    const tmp = origin;
    setOrigin(destination);
    setDestination(tmp);
  };

  const handleTextChange = (text: string, field: 'origin' | 'destination') => {
    if (field === 'origin') {
      setOrigin(text);
      inputRef.current = text;
    } else {
      setDestination(text);
      inputRef.current = text;
    }
    setActiveField(field);
  };

  const selectSuggestion = (description: string) => {
    if (activeField === 'origin') {
      setOrigin(description);
      inputRef.current = description;
    } else if (activeField === 'destination') {
      setDestination(description);
      inputRef.current = description;
    }
    setActiveField(null);
  };

  const selectedVehicleObj = vehicles.find(v => v.id === selectedVehicle);
  const canCalculate = origin.trim().length > 1 && destination.trim().length > 1;

  // Memoized render function for FlatList
  const renderSuggestion = useCallback(({ item }: { item: { description: string; placeId: string } }) => (
    <SuggestionRow
      description={item.description}
      onPress={() => selectSuggestion(item.description)}
    />
  ), [activeField]);

  const keyExtractor = useCallback((item: { placeId: string }) => item.placeId, []);

  const handleCalculate = async () => {
    if (!canCalculate) return;
    setCalculating(true);
    try {
      const result = await routeService.calculate({
        origin: origin.trim(),
        destination: destination.trim(),
        vehicleId: selectedVehicle || undefined,
      });
      router.push({
        pathname: '/(tabs)/results',
        params: {
          routeId: result.route.id,
          tollCost: String(result.tollCost),
          tollDetails: JSON.stringify(result.tollDetails || []),
          fuelCost: String(result.fuelCost),
          totalCost: String(result.totalCost),
          origin: result.route.origin,
          destination: result.route.destination,
          distance: String(result.route.distance),
          duration: String(result.route.duration),
          routeCoordinates: result.route.routeCoordinates || '',
          stops: JSON.stringify(result.stops || []),
          nearbyRestAreas: JSON.stringify(result.nearbyRestAreas || []),
          alternatives: JSON.stringify(result.alternatives || []),
        },
      });
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Rota hesaplanamadı.');
    } finally {
      setCalculating(false);
    }
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.root}>
      <MapView
        key={userLocation ? 'user' : 'default'}
        style={StyleSheet.absoluteFillObject}
        provider={MAP_PROVIDER}
        initialRegion={
          userLocation
            ? { ...userLocation, latitudeDelta: 0.08, longitudeDelta: 0.08 }
            : TURKEY_REGION
        }
        scrollEnabled
        zoomEnabled
        showsUserLocation
        showsMyLocationButton
        showsCompass={false}
      />

      {/* Top Input Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.topContainer, { paddingTop: insets.top + 12 }]}
        pointerEvents="box-none"
      >
        <Card backgroundColor="white" borderRadius={20} marginHorizontal={16} paddingVertical={4} elevate style={styles.inputCard}>
          <XStack alignItems="center" paddingHorizontal={16} paddingVertical={12} gap={12}>
            <View style={styles.dotGreen} />
            <TextInput
              style={styles.input}
              placeholder="Kalkış noktası"
              placeholderTextColor="#9CA3AF"
              value={origin}
              onChangeText={(t) => handleTextChange(t, 'origin')}
              onFocus={() => setActiveField('origin')}
              returnKeyType="next"
              autoCorrect={false}
            />
          </XStack>
          <XStack alignItems="center" paddingLeft={27} paddingRight={12}>
            <View style={styles.routeLine} />
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={swap} style={styles.swapBtn} activeOpacity={0.7}>
              <ArrowUpDown size={16} color="#6B7280" />
            </TouchableOpacity>
          </XStack>
          <XStack alignItems="center" paddingHorizontal={16} paddingVertical={12} gap={12}>
            <View style={styles.dotRed} />
            <TextInput
              style={styles.input}
              placeholder="Varış noktası"
              placeholderTextColor="#9CA3AF"
              value={destination}
              onChangeText={(t) => handleTextChange(t, 'destination')}
              onFocus={() => setActiveField('destination')}
              returnKeyType="done"
              autoCorrect={false}
            />
          </XStack>
        </Card>

        {/* Autocomplete suggestions */}
        {suggestions.length > 0 && activeField && (
          <View style={styles.suggestionsContainer}>
            <FlatList
              data={suggestions}
              keyExtractor={keyExtractor}
              keyboardShouldPersistTaps="always"
              style={{ maxHeight: 200 }}
              renderItem={renderSuggestion}
              initialNumToRender={6}
              windowSize={5}
            />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Bottom Panel */}
      <View style={styles.bottomContainer}>
        {vehiclePanelOpen && (
          <Card backgroundColor="white" borderRadius={16} marginBottom={10} elevate>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.vehicleRow} onPress={() => { setSelectedVehicle(null); setVehiclePanelOpen(false); }}>
                <Text fontSize={14} color="#9CA3AF" flex={1}>Araç seçme</Text>
                {!selectedVehicle && <CheckCircle2 size={18} color="#2563EB" />}
              </TouchableOpacity>
              {vehicles.length === 0 ? (
                <YStack padding={16} alignItems="center">
                  <Text fontSize={13} color="#9CA3AF">Araç eklenmemiş</Text>
                  <TouchableOpacity onPress={() => { setVehiclePanelOpen(false); router.push('/vehicles/add'); }}>
                    <Text fontSize={13} color="#2563EB" fontWeight="600" marginTop={8}>+ Araç Ekle</Text>
                  </TouchableOpacity>
                </YStack>
              ) : vehicles.map((v) => (
                <TouchableOpacity key={v.id} style={styles.vehicleRow} onPress={() => { setSelectedVehicle(v.id); setVehiclePanelOpen(false); }}>
                  <YStack flex={1}>
                    <Text fontSize={14} fontWeight="600" color="#1C1C1E">{v.name}</Text>
                    <Text fontSize={12} color="#9CA3AF">{v.brand} {v.model} · {v.fuelType}</Text>
                  </YStack>
                  {selectedVehicle === v.id && <CheckCircle2 size={18} color="#2563EB" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>
        )}

        <TouchableOpacity activeOpacity={0.85} onPress={() => setVehiclePanelOpen(v => !v)} style={styles.vehicleSelector}>
          <XStack alignItems="center" gap={12}>
            <View style={styles.carIcon}>
              <Car size={20} color="#2563EB" />
            </View>
            <YStack flex={1}>
              <Text fontSize={11} color="#9CA3AF" fontWeight="600" letterSpacing={0.5}>ARAÇ</Text>
              <Text fontSize={15} fontWeight="600" color="#1C1C1E" numberOfLines={1}>
                {selectedVehicleObj ? selectedVehicleObj.name : 'İsteğe bağlı'}
              </Text>
            </YStack>
            <ChevronRight size={18} color="#9CA3AF" />
          </XStack>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={canCalculate ? 0.85 : 1} onPress={handleCalculate} style={[styles.calcBtn, !canCalculate && styles.calcBtnDisabled]}>
          <Text fontSize={17} fontWeight="700" color="white" letterSpacing={-0.3}>Hesapla</Text>
          <ChevronRight size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Loading Overlay */}
      {calculating && (
        <View style={styles.loadingOverlay}>
          <Animated.View style={[styles.spinRing, { transform: [{ rotate: spin }] }]} />
          <Animated.Text style={[styles.loadingTitle, { transform: [{ scale: pulseAnim }] }]}>
            Hesaplanıyor...
          </Animated.Text>
          <Text fontSize={15} color="#3A3A3C" textAlign="center" marginTop={10}>
            {origin} → {destination}
          </Text>
          <Text fontSize={12} color="#8E8E93" textAlign="center" marginTop={6}>
            Gişe ve yakıt maliyetleri hesaplanıyor
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  inputCard: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  input: { flex: 1, fontSize: 16, color: '#1C1C1E', fontWeight: '500', paddingVertical: 0 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#34C759' },
  dotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF2D55' },
  routeLine: { width: 2, height: 16, backgroundColor: '#E5E7EB' },
  swapBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  bottomContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 88, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 8, zIndex: 10 },
  vehicleSelector: { backgroundColor: 'white', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  carIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  footer: { flexDirection: 'row', padding: 16, paddingBottom: 24, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E0E0', gap: 12 },
  calcBtn: { backgroundColor: '#0A84FF', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#0A84FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  calcBtnDisabled: { backgroundColor: '#C7C7CC', shadowOpacity: 0 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  spinRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: 'rgba(10,132,255,0.15)', borderTopColor: '#0A84FF' },
  loadingTitle: { fontSize: 24, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5, marginTop: 28 },
  suggestionsContainer: { backgroundColor: 'white', borderRadius: 16, marginHorizontal: 16, marginTop: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8, zIndex: 20 },
});
