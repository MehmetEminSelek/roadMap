/**
 * ExtraParamsSheet
 * ------------------------------------------------------------------
 * "Hesapla" butonuna basıldığında açılan bottom-sheet. Kullanıcı burada
 * otoyol seyir hızını, klima durumunu ve (araç seçiliyse) başlangıç
 * yakıt yüzdesini ayarlar.
 *
 * Kritik UX detayı: Bu sheet açılırken arka planda rota API çağrısı zaten
 * başlamış oluyor — kullanıcı ayarlarla uğraşırken request cevaplanıyor ve
 * confirm'de navigate anında gerçekleşiyor.
 *
 * Hız + klima faktörleri client-side uygulanıyor (speed^1.8 modeli ve
 * 1.6L default motor hacminde %6 klima etkisi). Backend'in döndürdüğü
 * fuelCost üzerine tek çarpma → ikinci API gerekmiyor.
 */
import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { FuelPctSlider } from './FuelPctSlider';

export interface ExtraParams {
  speedKph: number;
  acOn: boolean;
  initialFuelPct: number;
}

interface Props {
  visible: boolean;
  hasVehicle: boolean;
  defaultFuelPct: number;
  loading: boolean; // true: background API hala çalışıyor
  onConfirm: (params: ExtraParams) => void;
  onCancel: () => void;
}

/** Speed factor: (kph/90)^1.8, clamp [0.80, 1.60] */
const calcSpeedF = (kph: number) =>
  Math.max(0.8, Math.min(1.6, Math.pow(kph / 90, 1.8)));
/** AC factor at default 1.6L displacement */
const calcAcF = (on: boolean) => (on ? 1.06 : 1.0);

const SPEEDS = [80, 90, 100, 110, 120, 130, 140];
const DEFAULT_SPEED = 110;

export function ExtraParamsSheet({
  visible,
  hasVehicle,
  defaultFuelPct,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const [speedKph, setSpeedKph] = useState(DEFAULT_SPEED);
  const [acOn, setAcOn] = useState(true);
  const [fuelPct, setFuelPct] = useState(defaultFuelPct);
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      setSpeedKph(DEFAULT_SPEED);
      setAcOn(true);
      setFuelPct(defaultFuelPct);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Varsayılana göre yakıt etkisi
  const defaultMul = calcSpeedF(DEFAULT_SPEED) * calcAcF(true);
  const currentMul = calcSpeedF(speedKph) * calcAcF(acOn);
  const diffPct = Math.round((currentMul / defaultMul - 1) * 100);
  const impactLabel =
    diffPct > 0
      ? `+%${diffPct} yakıt`
      : diffPct < 0
        ? `-%${Math.abs(diffPct)} yakıt`
        : 'varsayılan';
  const impactColor = diffPct > 0 ? '#FF3B30' : diffPct < 0 ? '#34C759' : '#8E8E93';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onCancel}
    >
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onCancel} />
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={s.handle} />
        <Text style={s.title}>Seyahat Detayları</Text>

        {/* Hız chip picker */}
        <Text style={s.sectionLabel}>Otoyol Hızı</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {SPEEDS.map((sp) => (
            <TouchableOpacity
              key={sp}
              style={[s.chip, speedKph === sp && s.chipActive]}
              onPress={() => setSpeedKph(sp)}
              activeOpacity={0.8}
            >
              <Text style={[s.chipVal, speedKph === sp && s.chipValActive]}>{sp}</Text>
              <Text style={[s.chipUnit, speedKph === sp && s.chipValActive]}>km/s</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Klima */}
        <View style={s.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.sectionLabel}>Klima</Text>
            <Text style={s.sub}>Motor hacmine göre %2-8 etki</Text>
          </View>
          <Switch
            value={acOn}
            onValueChange={setAcOn}
            trackColor={{ true: '#0A84FF', false: '#D1D5DB' } as any}
          />
        </View>

        {/* Etki göstergesi */}
        <View style={s.impactBar}>
          <Text style={s.impactLabel}>Varsayılana göre yakıt etkisi</Text>
          <Text style={[s.impactValue, { color: impactColor }]}>{impactLabel}</Text>
        </View>

        {/* Fuel slider — sadece araç seçiliyse */}
        {hasVehicle && (
          <View style={{ marginBottom: 16 }}>
            <FuelPctSlider value={fuelPct} onChange={setFuelPct} />
          </View>
        )}

        <TouchableOpacity
          style={[s.confirmBtn, loading && s.confirmBtnLoading]}
          onPress={() => onConfirm({ speedKph, acOn, initialFuelPct: fuelPct })}
          activeOpacity={0.85}
        >
          <Text style={s.confirmText}>
            {loading ? 'Hesaplanıyor...' : 'Hesapla'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.40)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 44,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  sub: { fontSize: 11, color: '#8E8E93' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    minWidth: 60,
  },
  chipActive: { backgroundColor: '#0A84FF' },
  chipVal: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  chipValActive: { color: 'white' },
  chipUnit: { fontSize: 9, color: '#6B7280', fontWeight: '600', marginTop: 1 },
  impactBar: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  impactLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  impactValue: { fontSize: 14, fontWeight: '800' },
  confirmBtn: {
    backgroundColor: '#0A84FF',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmBtnLoading: { backgroundColor: '#6B7280' },
  confirmText: { fontSize: 17, fontWeight: '700', color: 'white', letterSpacing: -0.3 },
});
