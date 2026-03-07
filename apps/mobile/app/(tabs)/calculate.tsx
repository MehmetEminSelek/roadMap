import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MapPin, Car, Clock, Plus, X, ChevronRight } from 'lucide-react-native';
import { vehicleService } from '@/services/vehicleService';
import { routeService } from '@/services/routeService';
import type { Vehicle } from '@/types/api';

export default function CalculateScreen() {
  const params = useLocalSearchParams();
  const hasSearchParams = !!(params.origin && params.destination);

  const [step, setStep] = useState<number>(hasSearchParams ? 2 : 1);
  const [origin, setOrigin] = useState<string>((params.origin as string) || '');
  const [destination, setDestination] = useState<string>((params.destination as string) || '');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [stopsCount, setStopsCount] = useState<number>(1);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [])
  );


  const loadVehicles = async () => {
    setLoadingVehicles(true);
    try {
      const data = await vehicleService.getAll();
      setVehicles(data);
    } catch (error) {
      console.error('Araçlar yüklenirken hata:', error);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!origin.trim() || !destination.trim()) {
        Alert.alert('Hata', 'Lütfen kalkış ve varış yerlerini girin.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const result = await routeService.calculate({
        origin: origin.trim(),
        destination: destination.trim(),
        vehicleId: selectedVehicle || undefined,
        stopsCount,
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
          vehicleName: vehicles.find(v => v.id === selectedVehicle)?.name || '',
          fuelType: vehicles.find(v => v.id === selectedVehicle)?.fuelType || '',
          stops: JSON.stringify(result.stops || []),
        },
      });
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Rota hesaplanırken bir hata oluştu.');
    } finally {
      setCalculating(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const swapLocations = () => {
    const tmp = origin;
    setOrigin(destination);
    setDestination(tmp);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Yol Hesapla</Text>
        <View style={styles.progressContainer}>
          <View style={[styles.progressStep, step >= 1 && styles.progressStepActive]}>
            <Text style={[styles.progressNumber, step >= 1 && styles.progressNumberActive]}>1</Text>
            <Text style={[styles.progressText, step >= 1 && styles.progressTextActive]}>Rota</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={[styles.progressStep, step >= 2 && styles.progressStepActive]}>
            <Text style={[styles.progressNumber, step >= 2 && styles.progressNumberActive]}>2</Text>
            <Text style={[styles.progressText, step >= 2 && styles.progressTextActive]}>Araç</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={[styles.progressStep, step >= 3 && styles.progressStepActive]}>
            <Text style={[styles.progressNumber, step >= 3 && styles.progressNumberActive]}>3</Text>
            <Text style={[styles.progressText, step >= 3 && styles.progressTextActive]}>Hesapla</Text>
          </View>
        </View>
      </View>

      {calculating ? (
        <View style={styles.calculatingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.calculatingText}>Rota ve maliyet hesaplanıyor...</Text>
        </View>
      ) : (
        <>
          {step === 1 && (
            <View style={styles.stepContainer}>
              <View style={styles.inputGroup}>
                <View style={styles.inputRow}>
                  <MapPin size={20} color="#007AFF" />
                  <Text style={styles.label}>Kalkış Yeri</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: İstanbul"
                    placeholderTextColor="#8E8E93"
                    value={origin}
                    onChangeText={setOrigin}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputRow}>
                  <MapPin size={20} color="#FF3B30" />
                  <Text style={styles.label}>Varış Yeri</Text>
                </View>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: Ankara"
                    placeholderTextColor="#8E8E93"
                    value={destination}
                    onChangeText={setDestination}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.swapButton} onPress={swapLocations}>
                <Text style={styles.swapButtonText}>Yerleri Değiştir</Text>
              </TouchableOpacity>

              <View style={styles.stopsContainer}>
                <View style={styles.inputRow}>
                  <Clock size={20} color="#34C759" />
                  <Text style={styles.label}>Mola Sayısı</Text>
                </View>
                <View style={styles.stopsControls}>
                  <TouchableOpacity
                    style={styles.stopsButton}
                    onPress={() => setStopsCount(Math.max(0, stopsCount - 1))}
                  >
                    <X size={20} color="#8E8E93" />
                  </TouchableOpacity>
                  <Text style={styles.stopsCount}>{stopsCount}</Text>
                  <TouchableOpacity
                    style={styles.stopsButton}
                    onPress={() => setStopsCount(stopsCount + 1)}
                  >
                    <Plus size={20} color="#007AFF" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.stopsHint}>Rotaya dahil edilecek mola noktaları sayısı</Text>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.sectionTitle}>Araç Seçin</Text>

              {loadingVehicles ? (
                <ActivityIndicator size="small" color="#007AFF" style={{ marginVertical: 20 }} />
              ) : vehicles.length === 0 ? (
                <View style={styles.emptyVehicles}>
                  <Car size={48} color="#E0E0E0" />
                  <Text style={styles.emptyText}>Henüz araç eklenmedi</Text>
                  <TouchableOpacity
                    style={styles.addVehicleButtonPrimary}
                    onPress={() => router.push('/vehicles/add')}
                  >
                    <Text style={styles.addVehicleButtonPrimaryText}>Araç Ekle</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {vehicles.map((vehicle) => (
                    <TouchableOpacity
                      key={vehicle.id}
                      style={[styles.vehicleCard, selectedVehicle === vehicle.id && styles.vehicleCardSelected]}
                      onPress={() => setSelectedVehicle(vehicle.id)}
                    >
                      <View style={styles.vehicleInfo}>
                        <Text style={styles.vehicleName}>{vehicle.name}</Text>
                        <Text style={styles.vehicleDetails}>
                          {vehicle.brand} {vehicle.model} - {vehicle.fuelType}
                        </Text>
                      </View>
                      {selectedVehicle === vehicle.id && (
                        <View style={styles.checkBadge}>
                          <Text style={styles.checkBadgeText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {vehicles.length > 0 && (
                <TouchableOpacity
                  style={styles.addVehicleButton}
                  onPress={() => router.push('/vehicles/add')}
                >
                  <Plus size={20} color="#007AFF" />
                  <Text style={styles.addVehicleText}>Yeni Araç Ekle</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.summaryTitle}>Özet</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <MapPin size={20} color="#8E8E93" />
                  <Text style={styles.summaryText}>
                    {origin} → {destination}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Car size={20} color="#8E8E93" />
                  <Text style={styles.summaryText}>
                    {vehicles.find(v => v.id === selectedVehicle)?.name || 'Araç seçilmedi'}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Clock size={20} color="#8E8E93" />
                  <Text style={styles.summaryText}>{stopsCount} mola noktası</Text>
                </View>
              </View>

              <Text style={styles.warningText}>
                * Hesaplamalar tahmini değerlerdir. Gerçek maliyet farklılık gösterebilir.
              </Text>
            </View>
          )}

          <View style={styles.footer}>
            {step > 1 && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Text style={styles.backButtonText}>Geri</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.calculateButton,
                (origin && destination) || step > 1 ? styles.calculateButtonEnabled : styles.calculateButtonDisabled,
              ]}
              onPress={step === 3 ? handleCalculate : handleNext}
              disabled={!(origin && destination) && step === 1}
            >
              <Text style={styles.calculateButtonText}>
                {step === 3 ? 'Hesapla' : 'İleri'}
              </Text>
              {step < 3 && <ChevronRight size={20} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  header: { backgroundColor: '#FFFFFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1E', marginBottom: 16 },
  progressContainer: { flexDirection: 'row', alignItems: 'center' },
  progressStep: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressStepActive: { opacity: 1 },
  progressNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E0E0E0', color: '#8E8E93', textAlign: 'center', lineHeight: 28, fontSize: 14, fontWeight: '600' },
  progressNumberActive: { backgroundColor: '#007AFF', color: '#FFFFFF' },
  progressText: { fontSize: 12, color: '#8E8E93' },
  progressTextActive: { color: '#1C1C1E', fontWeight: '500' },
  progressLine: { flex: 1, height: 2, backgroundColor: '#E0E0E0', marginHorizontal: 8 },
  calculatingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  calculatingText: { marginTop: 16, fontSize: 16, color: '#8E8E93' },
  stepContainer: { padding: 16 },
  inputGroup: { marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  label: { fontSize: 14, fontWeight: '500', color: '#1C1C1E' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F7', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E0E0E0' },
  input: { flex: 1, fontSize: 16, color: '#1C1C1E' },
  swapButton: { paddingVertical: 12, alignItems: 'center' },
  swapButtonText: { fontSize: 14, color: '#007AFF', textDecorationLine: 'underline' },
  stopsContainer: { marginBottom: 20 },
  stopsControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stopsButton: { padding: 8 },
  stopsCount: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E', width: 40, textAlign: 'center' },
  stopsHint: { fontSize: 12, color: '#8E8E93', marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1C1C1E', marginBottom: 16 },
  emptyVehicles: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: '#8E8E93', marginTop: 12, marginBottom: 16 },
  addVehicleButtonPrimary: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  addVehicleButtonPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  vehicleCardSelected: { borderColor: '#007AFF', backgroundColor: '#E0F7FF' },
  vehicleInfo: { flex: 1 },
  vehicleName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginBottom: 4 },
  vehicleDetails: { fontSize: 13, color: '#8E8E93' },
  checkBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  checkBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  addVehicleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  addVehicleText: { fontSize: 14, color: '#007AFF', fontWeight: '500' },
  summaryTitle: { fontSize: 18, fontWeight: '600', color: '#1C1C1E', marginBottom: 16 },
  summaryCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 16 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  summaryText: { fontSize: 14, color: '#1C1C1E', flex: 1 },
  warningText: { fontSize: 12, color: '#FF9500', textAlign: 'center' },
  footer: { flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E0E0', gap: 12 },
  backButton: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#8E8E93' },
  calculateButton: { flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#E0E0E0' },
  calculateButtonEnabled: { backgroundColor: '#007AFF' },
  calculateButtonDisabled: { backgroundColor: '#E0E0E0' },
  calculateButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
