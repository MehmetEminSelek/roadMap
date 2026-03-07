import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { vehicleService } from '@/services/vehicleService';
import type { Brand, VehicleModel, FuelType, Transmission } from '@/types/api';

const FUEL_TYPES: { label: string; value: FuelType }[] = [
  { label: 'Benzin', value: 'PETROL' },
  { label: 'Dizel', value: 'DIZEL' },
  { label: 'Hibrit', value: 'HYBRID' },
  { label: 'Elektrik', value: 'ELECTRIC' },
  { label: 'LPG', value: 'LPG' },
];

const TRANSMISSIONS: { label: string; value: Transmission }[] = [
  { label: 'Manuel', value: 'MANUAL' },
  { label: 'Otomatik', value: 'AUTOMATIC' },
  { label: 'CVT', value: 'CVT' },
  { label: 'Yarı Otomatik', value: 'SEMI_AUTOMATIC' },
];

export default function AddVehicleScreen() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [name, setName] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('PETROL');
  const [transmission, setTransmission] = useState<Transmission>('MANUAL');
  const [enginePower, setEnginePower] = useState('');
  const [engineCapacity, setEngineCapacity] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingBrands, setLoadingBrands] = useState(true);

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    if (selectedBrand) {
      loadModels(selectedBrand.id);
    }
  }, [selectedBrand]);

  const loadBrands = async () => {
    try {
      const data = await vehicleService.getBrands();
      setBrands(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBrands(false);
    }
  };

  const loadModels = async (brandId: string) => {
    try {
      const data = await vehicleService.getModels(brandId);
      setModels(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!selectedBrand || !name.trim()) {
      Alert.alert('Hata', 'Lütfen marka, model ve araç adı girin.');
      return;
    }

    setSaving(true);
    try {
      await vehicleService.create({
        name: name.trim(),
        brand: selectedBrand.name,
        model: selectedModel?.name || '',
        fuelType,
        enginePower: parseInt(enginePower) || 100,
        engineCapacity: parseInt(engineCapacity) || 1600,
        weight: parseInt(weight) || 1300,
        transmission,
        hasClimateControl: true,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Araç eklenirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingBrands) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Marka</Text>
        <View style={styles.chipGrid}>
          {brands.map((brand) => (
            <TouchableOpacity
              key={brand.id}
              style={[styles.chip, selectedBrand?.id === brand.id && styles.chipSelected]}
              onPress={() => { setSelectedBrand(brand); setSelectedModel(null); }}
            >
              <Text style={[styles.chipText, selectedBrand?.id === brand.id && styles.chipTextSelected]}>
                {brand.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {selectedBrand && models.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Model</Text>
          <View style={styles.chipGrid}>
            {models.map((model) => (
              <TouchableOpacity
                key={model.id}
                style={[styles.chip, selectedModel?.id === model.id && styles.chipSelected]}
                onPress={() => {
                  setSelectedModel(model);
                  if (!name) setName(`${selectedBrand.name} ${model.name}`);
                }}
              >
                <Text style={[styles.chipText, selectedModel?.id === model.id && styles.chipTextSelected]}>
                  {model.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Araç Adı</Text>
        <TextInput
          style={styles.input}
          placeholder="Örn: Astra 1.4 Turbo"
          placeholderTextColor="#8E8E93"
          value={name}
          onChangeText={setName}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Yakıt Tipi</Text>
        <View style={styles.chipGrid}>
          {FUEL_TYPES.map((ft) => (
            <TouchableOpacity
              key={ft.value}
              style={[styles.chip, fuelType === ft.value && styles.chipSelected]}
              onPress={() => setFuelType(ft.value)}
            >
              <Text style={[styles.chipText, fuelType === ft.value && styles.chipTextSelected]}>
                {ft.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vites</Text>
        <View style={styles.chipGrid}>
          {TRANSMISSIONS.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.chip, transmission === t.value && styles.chipSelected]}
              onPress={() => setTransmission(t.value)}
            >
              <Text style={[styles.chipText, transmission === t.value && styles.chipTextSelected]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Teknik Bilgiler</Text>
        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Motor Gücü (HP)</Text>
            <TextInput
              style={styles.input}
              placeholder="150"
              placeholderTextColor="#8E8E93"
              value={enginePower}
              onChangeText={setEnginePower}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Motor Hacmi (cc)</Text>
            <TextInput
              style={styles.input}
              placeholder="1600"
              placeholderTextColor="#8E8E93"
              value={engineCapacity}
              onChangeText={setEngineCapacity}
              keyboardType="numeric"
            />
          </View>
        </View>
        <Text style={styles.inputLabel}>Ağırlık (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="1300"
          placeholderTextColor="#8E8E93"
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginBottom: 12 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0' },
  chipSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { fontSize: 14, color: '#1C1C1E' },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  input: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, fontSize: 16, color: '#1C1C1E', borderWidth: 1, borderColor: '#E0E0E0' },
  inputLabel: { fontSize: 13, color: '#8E8E93', marginBottom: 6, marginTop: 8 },
  row: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1 },
  footer: { padding: 16, paddingBottom: 40 },
  saveButton: { backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
