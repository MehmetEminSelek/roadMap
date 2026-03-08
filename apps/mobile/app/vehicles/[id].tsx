import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check } from 'lucide-react-native';
import { vehicleService } from '@/services/vehicleService';
import type { Vehicle, FuelType, Transmission } from '@/types/api';
import { C } from '@/theme';

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
  const insets = useSafeAreaInsets();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [name, setName] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('PETROL');
  const [transmission, setTransmission] = useState<Transmission>('MANUAL');
  const [enginePower, setEnginePower] = useState('');
  const [engineCapacity, setEngineCapacity] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadVehicle(); }, [id]);

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
      <View style={[styles.fill, styles.centered]}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  const selectedFuelColor = C.fuel[fuelType] || C.gold;

  return (
    <View style={styles.fill}>
      {/* ── Header ───────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Aracı Düzenle</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Araç Adı ─────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ARAÇ ADI</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="örn. Benim Arabam"
            placeholderTextColor={C.textSoft}
            selectionColor={C.gold}
          />
        </View>

        {/* ── Marka / Model (read-only) ─────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MARKA / MODEL</Text>
          <View style={styles.readOnlyBox}>
            <Text style={styles.readOnlyText}>{vehicle?.brand} {vehicle?.model}</Text>
          </View>
        </View>

        {/* ── Yakıt Tipi ───────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YAKIT TİPİ</Text>
          <View style={styles.chipGrid}>
            {FUEL_TYPES.map((ft) => {
              const active = fuelType === ft.value;
              const color = C.fuel[ft.value] || C.gold;
              return (
                <TouchableOpacity
                  key={ft.value}
                  style={[
                    styles.chip,
                    active && { backgroundColor: `${color}18`, borderColor: color },
                  ]}
                  onPress={() => setFuelType(ft.value)}
                >
                  {active && (
                    <View style={[styles.chipDot, { backgroundColor: color }]} />
                  )}
                  <Text style={[styles.chipText, active && { color, fontWeight: '700' }]}>
                    {ft.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Vites ────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>VİTES</Text>
          <View style={styles.chipGrid}>
            {TRANSMISSIONS.map((t) => {
              const active = transmission === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.chip,
                    active && { backgroundColor: C.goldSubtle, borderColor: C.gold },
                  ]}
                  onPress={() => setTransmission(t.value)}
                >
                  {active && (
                    <View style={[styles.chipDot, { backgroundColor: C.gold }]} />
                  )}
                  <Text style={[styles.chipText, active && { color: C.gold, fontWeight: '700' }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Teknik Bilgiler ───────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TEKNİK BİLGİLER</Text>
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Motor Gücü (HP)</Text>
              <TextInput
                style={styles.input}
                value={enginePower}
                onChangeText={setEnginePower}
                keyboardType="numeric"
                placeholder="150"
                placeholderTextColor={C.textSoft}
                selectionColor={C.gold}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Motor Hacmi (cc)</Text>
              <TextInput
                style={styles.input}
                value={engineCapacity}
                onChangeText={setEngineCapacity}
                keyboardType="numeric"
                placeholder="1600"
                placeholderTextColor={C.textSoft}
                selectionColor={C.gold}
              />
            </View>
          </View>
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Ağırlık (kg)</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            placeholder="1300"
            placeholderTextColor={C.textSoft}
            selectionColor={C.gold}
          />
        </View>

        {/* ── Save Button ───────────────────────── */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#090909" />
          ) : (
            <>
              <Check size={18} color="#090909" />
              <Text style={styles.saveButtonText}>Güncelle</Text>
            </>
          )}
        </TouchableOpacity>

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
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

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
  },
  iconBtn: { padding: 8 },

  // ── Sections
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSoft,
    letterSpacing: 1,
    marginBottom: 10,
  },

  // ── Input
  input: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputLabel: {
    fontSize: 12,
    color: C.textSoft,
    fontWeight: '600',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: { flex: 1 },

  // ── Read-only
  readOnlyBox: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borderMuted,
  },
  readOnlyText: {
    fontSize: 16,
    color: C.textSoft,
    fontWeight: '500',
  },

  // ── Chips
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  chipText: {
    fontSize: 14,
    color: C.textSoft,
    fontWeight: '500',
  },

  // ── Save Button
  saveButton: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#090909',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
