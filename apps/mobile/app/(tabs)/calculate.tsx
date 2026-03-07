import { useState, useCallback, useRef, useEffect } from 'react';
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
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { YStack, XStack, Text, Card } from 'tamagui';
import { ArrowUpDown, ChevronRight, CheckCircle2, Car } from 'lucide-react-native';
import { vehicleService } from '@/services/vehicleService';
import { routeService } from '@/services/routeService';
import type { Vehicle } from '@/types/api';

const MAP_PROVIDER = Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE;

const TURKEY_REGION = {
  latitude: 39.0,
  longitude: 35.0,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

export default function CalculateScreen() {
  const insets = useSafeAreaInsets();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [vehiclePanelOpen, setVehiclePanelOpen] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

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

  const selectedVehicleObj = vehicles.find(v => v.id === selectedVehicle);
  const canCalculate = origin.trim().length > 1 && destination.trim().length > 1;

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
        style={StyleSheet.absoluteFillObject}
        provider={MAP_PROVIDER}
        initialRegion={TURKEY_REGION}
        scrollEnabled
        zoomEnabled
        showsUserLocation
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
              onChangeText={setOrigin}
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
              onChangeText={setDestination}
              returnKeyType="done"
              autoCorrect={false}
            />
          </XStack>
        </Card>
      </KeyboardAvoidingView>

      {/* Bottom Panel */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 16 }]}>
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
          <Text fontSize={15} color="rgba(255,255,255,0.65)" textAlign="center" marginTop={10}>
            {origin} → {destination}
          </Text>
          <Text fontSize={12} color="rgba(255,255,255,0.4)" textAlign="center" marginTop={6}>
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
  bottomContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, zIndex: 10 },
  vehicleSelector: { backgroundColor: 'white', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  carIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  calcBtn: { backgroundColor: '#1C1C1E', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#1C1C1E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  calcBtnDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,8,8,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  spinRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: 'rgba(255,255,255,0.12)', borderTopColor: 'white' },
  loadingTitle: { fontSize: 24, fontWeight: '800', color: 'white', letterSpacing: -0.5, marginTop: 28 },
});
