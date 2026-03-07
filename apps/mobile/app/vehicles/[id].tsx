import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { vehicleService } from '@/services/vehicleService';
import type { Vehicle, FuelType, Transmission } from '@/types/api';

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

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [name, setName] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('PETROL');
  const [transmission, setTransmission] = useState<Transmission>('MANUAL');
  const [enginePower, setEnginePower] = useState('');
  const [engineCapacity, setEngineCapacity] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVehicle();
  }, [id]);

  const loadVehicle = async () => {
    try {
      const data = await vehicleService.getOne(id as string);
      setVehicle(data);
      setName(data.name);
      setFuelType(data.fuelType);
      setTransmission(data.transmission);
      setEnginePower(String(data.enginePower));
      setEngineCapacity(String(data.engineCapacity));
      setWeight(String(data.weight));
    } catch (err: any) {
      Alert.alert('Hata', err.message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Hata', 'Araç adını girin.');
      return;
    }

    setSaving(true);
    try {
      await vehicleService.update(id as string, {
        name: name.trim(),
        fuelType,
        transmission,
        enginePower: parseInt(enginePower) || vehicle?.enginePower || 100,
        engineCapacity: parseInt(engineCapacity) || vehicle?.engineCapacity || 1600,
        weight: parseInt(weight) || vehicle?.weight || 1300,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Araç güncellenirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Araç Adı</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Marka / Model</Text>
        <Text style={styles.readOnly}>{vehicle?.brand} {vehicle?.model}</Text>
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
            <TextInput style={styles.input} value={enginePower} onChangeText={setEnginePower} keyboardType="numeric" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Motor Hacmi (cc)</Text>
            <TextInput style={styles.input} value={engineCapacity} onChangeText={setEngineCapacity} keyboardType="numeric" />
          </View>
        </View>
        <Text style={styles.inputLabel}>Ağırlık (kg)</Text>
        <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Güncelle</Text>}
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
  label: { fontSize: 13, color: '#8E8E93', marginBottom: 6 },
  readOnly: { fontSize: 16, color: '#1C1C1E', fontWeight: '500', backgroundColor: '#F0F0F5', padding: 16, borderRadius: 12 },
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
