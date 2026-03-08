/**
 * Add Vehicle Screen — "Precision Garage" Design
 * Dark automotive aesthetic · Gold accent · Numbered configurator steps
 */
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
  Keyboard,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Search, X, CheckCircle2, ChevronRight, Car } from 'lucide-react-native';
import { vehicleService } from '@/services/vehicleService';
import type { Brand, VehicleModel, VehicleTrim, FuelType, Transmission } from '@/types/api';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:            '#090909',
  surface:       '#111111',
  card:          '#181818',
  cardHover:     '#1E1E1E',
  border:        '#252525',
  borderMuted:   '#1A1A1A',
  gold:          '#D4952A',
  goldLight:     '#E8AE4C',
  goldSubtle:    'rgba(212,149,42,0.12)',
  text:          '#F0F0F0',
  textSoft:      '#777777',
  textFaint:     '#3A3A3A',
  success:       '#30D158',
  successSubtle: 'rgba(48,209,88,0.10)',
  white:         '#FFFFFF',
};

const FUEL_COLORS: Record<FuelType, { solid: string; subtle: string }> = {
  PETROL:   { solid: '#FF9F0A', subtle: 'rgba(255,159,10,0.12)'  },
  DIZEL:    { solid: '#0A84FF', subtle: 'rgba(10,132,255,0.12)'  },
  HYBRID:   { solid: '#30D158', subtle: 'rgba(48,209,88,0.12)'   },
  ELECTRIC: { solid: '#5AC8FA', subtle: 'rgba(90,200,250,0.12)'  },
  LPG:      { solid: '#BF5AF2', subtle: 'rgba(191,90,242,0.12)'  },
};

const FUEL_LABELS: Record<FuelType, string> = {
  PETROL: 'Benzin', DIZEL: 'Dizel', HYBRID: 'Hibrit',
  ELECTRIC: 'Elektrik', LPG: 'LPG',
};

const TX_LABELS: Record<Transmission, string> = {
  MANUAL: 'Manuel', AUTOMATIC: 'Otomatik',
  CVT: 'CVT', SEMI_AUTOMATIC: 'Yarı Oto.',
};

const FUEL_TYPES: { value: FuelType }[] = [
  { value: 'PETROL' }, { value: 'DIZEL' }, { value: 'HYBRID' },
  { value: 'ELECTRIC' }, { value: 'LPG' },
];

const TX_TYPES: { value: Transmission }[] = [
  { value: 'MANUAL' }, { value: 'AUTOMATIC' },
  { value: 'CVT' }, { value: 'SEMI_AUTOMATIC' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trimLabel(trim: VehicleTrim): string {
  const fuel = FUEL_LABELS[trim.fuelType];
  const cc   = trim.engineCapacity ? ` ${(trim.engineCapacity / 1000).toFixed(1)}L` : '';
  const trx  = trim.transmission   ? ` · ${TX_LABELS[trim.transmission]}` : '';
  return `${fuel}${cc}${trx}`;
}

// ─── StepHeader ───────────────────────────────────────────────────────────────

function StepHeader({
  num, label, done,
}: { num: string; label: string; done: boolean }) {
  return (
    <View style={sh.row}>
      <View style={[sh.badge, done && sh.badgeDone]}>
        {done
          ? <CheckCircle2 size={12} color={C.success} strokeWidth={2.5} />
          : <Text style={sh.num}>{num}</Text>
        }
      </View>
      <Text style={[sh.label, done && sh.labelDone]}>{label}</Text>
    </View>
  );
}
const sh = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  badge:     { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  badgeDone: { borderColor: C.success, backgroundColor: C.successSubtle },
  num:       { fontSize: 11, fontWeight: '700', color: C.textSoft },
  label:     { fontSize: 13, fontWeight: '700', color: C.textSoft, letterSpacing: 1.2, textTransform: 'uppercase' },
  labelDone: { color: C.success },
});

// ─── SearchInput ──────────────────────────────────────────────────────────────

interface SearchInputProps {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  onClear: () => void;
  onFocus?: () => void;
  selected: boolean;
  disabled?: boolean;
  loading?: boolean;
}
function SearchInput({ placeholder, value, onChangeText, onClear, onFocus, selected, disabled, loading }: SearchInputProps) {
  return (
    <View style={[si.wrap, disabled && si.wrapDisabled, selected && si.wrapSelected]}>
      <View style={si.icon}>
        {loading
          ? <ActivityIndicator size="small" color={C.gold} />
          : selected
            ? <CheckCircle2 size={17} color={C.success} strokeWidth={2.5} />
            : <Search size={17} color={disabled ? C.textFaint : C.textSoft} strokeWidth={2} />
        }
      </View>
      <TextInput
        style={[si.input, disabled && si.inputDisabled]}
        placeholder={placeholder}
        placeholderTextColor={disabled ? C.textFaint : C.textSoft}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        editable={!disabled}
        autoCorrect={false}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
      />
      {value.length > 0 && !disabled && (
        <TouchableOpacity onPress={onClear} style={si.clear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={13} color={C.textSoft} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </View>
  );
}
const si = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, minHeight: 52,
  },
  wrapDisabled: { opacity: 0.4 },
  wrapSelected: { borderColor: C.success + '55' },
  icon:         { marginRight: 10 },
  input:        { flex: 1, fontSize: 15, color: C.text, fontWeight: '500', paddingVertical: 14 },
  inputDisabled:{ color: C.textSoft },
  clear: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
});

// ─── Dropdown ────────────────────────────────────────────────────────────────

interface DropItem { id: string; name: string }
function Dropdown({ items, onSelect, query }: { items: DropItem[]; onSelect: (i: DropItem) => void; query: string }) {
  if (!items.length) return null;
  const q = query.toLowerCase();
  return (
    <View style={dr.box}>
      {items.map((item, idx) => {
        const lo  = item.name.toLowerCase();
        const mi  = lo.indexOf(q);
        const hit = q.length > 0 && mi >= 0;
        return (
          <TouchableOpacity
            key={item.id}
            style={[dr.row, idx < items.length - 1 && dr.divider]}
            onPress={() => onSelect(item)}
            activeOpacity={0.6}
          >
            {hit ? (
              <Text style={dr.txt}>
                {item.name.slice(0, mi)}
                <Text style={dr.match}>{item.name.slice(mi, mi + q.length)}</Text>
                {item.name.slice(mi + q.length)}
              </Text>
            ) : (
              <Text style={dr.txt}>{item.name}</Text>
            )}
            <ChevronRight size={14} color={C.textFaint} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const dr = StyleSheet.create({
  box: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    marginTop: 4, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, justifyContent: 'space-between' },
  divider: { borderBottomWidth: 1, borderBottomColor: C.borderMuted },
  txt:     { fontSize: 15, color: C.text, flex: 1 },
  match:   { color: C.goldLight, fontWeight: '700' },
});

// ─── TrimCard ─────────────────────────────────────────────────────────────────

function TrimCard({ trim, selected, onPress }: { trim: VehicleTrim; selected: boolean; onPress: () => void }) {
  const fc = FUEL_COLORS[trim.fuelType];
  return (
    <TouchableOpacity
      style={[tc.card, selected && { borderColor: fc.solid, backgroundColor: fc.subtle }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* left color strip */}
      <View style={[tc.strip, { backgroundColor: fc.solid }]} />
      <View style={tc.body}>
        <Text style={[tc.name, selected && { color: fc.solid }]}>{trimLabel(trim)}</Text>
        {trim.fuelEconomyL100 != null && (
          <Text style={tc.eco}>{trim.fuelEconomyL100} L/100km · EPA</Text>
        )}
      </View>
      <View style={[tc.dot, selected && { backgroundColor: fc.solid }]}>
        {selected && <CheckCircle2 size={16} color="#000" strokeWidth={3} />}
      </View>
    </TouchableOpacity>
  );
}
const tc = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', minHeight: 58,
  },
  strip: { width: 4, alignSelf: 'stretch' },
  body:  { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  name:  { fontSize: 15, fontWeight: '600', color: C.text },
  eco:   { fontSize: 12, color: C.textSoft, marginTop: 3 },
  dot: {
    width: 28, height: 28, borderRadius: 14, marginRight: 12,
    backgroundColor: C.border, justifyContent: 'center', alignItems: 'center',
  },
});

// ─── FuelChip / TxChip ────────────────────────────────────────────────────────

function FuelChip({ value, active, onPress }: { value: FuelType; active: boolean; onPress: () => void }) {
  const fc = FUEL_COLORS[value];
  return (
    <TouchableOpacity
      style={[chip.base, active && { borderColor: fc.solid, backgroundColor: fc.subtle }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[chip.dot, { backgroundColor: active ? fc.solid : C.textFaint }]} />
      <Text style={[chip.label, active && { color: fc.solid, fontWeight: '700' }]}>
        {FUEL_LABELS[value]}
      </Text>
    </TouchableOpacity>
  );
}

function TxChip({ value, active, onPress }: { value: Transmission; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[chip.base, active && chip.baseActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[chip.label, active && chip.labelActive]}>{TX_LABELS[value]}</Text>
    </TouchableOpacity>
  );
}

const chip = StyleSheet.create({
  base:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, gap: 6 },
  baseActive: { borderColor: C.gold, backgroundColor: C.goldSubtle },
  dot:        { width: 7, height: 7, borderRadius: 4 },
  label:      { fontSize: 14, color: C.textSoft, fontWeight: '500' },
  labelActive:{ color: C.goldLight, fontWeight: '700' },
});

// ─── Separator ────────────────────────────────────────────────────────────────

function Sep() { return <View style={{ height: 1, backgroundColor: C.borderMuted, marginHorizontal: 16 }} />; }

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddVehicleScreen() {
  const [brands,         setBrands]        = useState<Brand[]>([]);
  const [models,         setModels]        = useState<VehicleModel[]>([]);
  const [trims,          setTrims]         = useState<VehicleTrim[]>([]);

  const [selectedBrand,  setSelectedBrand] = useState<Brand | null>(null);
  const [selectedModel,  setSelectedModel] = useState<VehicleModel | null>(null);
  const [selectedTrim,   setSelectedTrim]  = useState<VehicleTrim | null>(null);

  const [brandQ,         setBrandQ]        = useState('');
  const [modelQ,         setModelQ]        = useState('');
  const [brandOpen,      setBrandOpen]     = useState(false);
  const [modelOpen,      setModelOpen]     = useState(false);

  const [vehicleName,    setVehicleName]   = useState('');
  const [fuelType,       setFuelType]      = useState<FuelType>('PETROL');
  const [transmission,   setTransmission]  = useState<Transmission>('MANUAL');
  const [enginePower,    setEnginePower]   = useState('');
  const [engineCap,      setEngineCap]     = useState('');
  const [weight,         setWeight]        = useState('');

  const [saving,         setSaving]        = useState(false);
  const [loadingBrands,  setLoadingBrands] = useState(true);
  const [loadingModels,  setLoadingModels] = useState(false);
  const [loadingTrims,   setLoadingTrims]  = useState(false);

  // ── Data loading ──

  useEffect(() => {
    vehicleService.getBrands()
      .then(setBrands).catch(console.error)
      .finally(() => setLoadingBrands(false));
  }, []);

  useEffect(() => {
    if (!selectedBrand) { setModels([]); return; }
    setLoadingModels(true);
    vehicleService.getModels(selectedBrand.id)
      .then(setModels).catch(console.error)
      .finally(() => setLoadingModels(false));
  }, [selectedBrand]);

  useEffect(() => {
    if (!selectedModel) { setTrims([]); setSelectedTrim(null); return; }
    setLoadingTrims(true);
    setSelectedTrim(null);
    vehicleService.getTrims(selectedModel.id)
      .then(setTrims).catch(console.error)
      .finally(() => setLoadingTrims(false));
  }, [selectedModel]);

  // ── Filtered lists (max 8) ──

  const filtBrands = (brandQ.length > 0
    ? brands.filter(b => b.name.toLowerCase().includes(brandQ.toLowerCase()))
    : brands
  ).slice(0, 8);

  const filtModels = (modelQ.length > 0
    ? models.filter(m => m.name.toLowerCase().includes(modelQ.toLowerCase()))
    : models
  ).slice(0, 8);

  // ── Handlers ──

  const pickBrand = (item: DropItem) => {
    const brand = brands.find(b => b.id === item.id) ?? { id: item.id, name: item.name };
    setSelectedBrand(brand); setBrandQ(brand.name); setBrandOpen(false);
    setSelectedModel(null); setModelQ('');
    setTrims([]); setSelectedTrim(null);
    Keyboard.dismiss();
  };

  const clearBrand = () => {
    setSelectedBrand(null); setBrandQ(''); setBrandOpen(false);
    setSelectedModel(null); setModelQ('');
    setModels([]); setTrims([]); setSelectedTrim(null);
  };

  const pickModel = (item: DropItem) => {
    const model = models.find(m => m.id === item.id);
    if (!model) return;
    setSelectedModel(model); setModelQ(model.name); setModelOpen(false);
    if (selectedBrand && !vehicleName)
      setVehicleName(`${selectedBrand.name} ${model.name}`);
    Keyboard.dismiss();
  };

  const clearModel = () => {
    setSelectedModel(null); setModelQ(''); setModelOpen(false);
    setTrims([]); setSelectedTrim(null);
  };

  const pickTrim = (trim: VehicleTrim) => {
    setSelectedTrim(trim);
    setFuelType(trim.fuelType);
    if (trim.transmission)  setTransmission(trim.transmission);
    if (trim.engineCapacity) setEngineCap(String(trim.engineCapacity));
  };

  const handleSave = async () => {
    if (!selectedBrand || !vehicleName.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen marka seçin ve araç adı girin.');
      return;
    }
    setSaving(true);
    try {
      await vehicleService.create({
        name: vehicleName.trim(),
        brand: selectedBrand.name,
        model: selectedModel?.name || '',
        fuelType,
        enginePower:    parseInt(enginePower) || 100,
        engineCapacity: parseInt(engineCap)   || 1600,
        weight:         parseInt(weight)      || 1300,
        transmission,
        hasClimateControl: true,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Araç eklenirken hata oluştu.');
    } finally { setSaving(false); }
  };

  const canSave = !!selectedBrand && vehicleName.trim().length > 0;

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loadingBrands) {
    return (
      <View style={s.loadWrap}>
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={s.loadTxt}>Araç veritabanı yükleniyor…</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* ── sticky top summary bar ─────────────────────────────────── */}
      <View style={s.topBar}>
        <Car size={16} color={C.gold} strokeWidth={2} />
        <Text style={s.topBarTxt} numberOfLines={1}>
          {[selectedBrand?.name, selectedModel?.name, selectedTrim ? trimLabel(selectedTrim) : null]
            .filter(Boolean).join('  ›  ') || 'Yeni araç yapılandırıyorsunuz'}
        </Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── 01 MARKA ───────────────────────────────────────────────── */}
        <View style={s.section}>
          <StepHeader num="01" label="Marka" done={!!selectedBrand} />
          <SearchInput
            placeholder="Marka ara…  (örn: Toyota, BMW)"
            value={brandQ}
            onChangeText={(t) => { setBrandQ(t); setBrandOpen(true); setSelectedBrand(null); }}
            onClear={clearBrand}
            onFocus={() => setBrandOpen(true)}
            selected={!!selectedBrand}
          />
          {brandOpen && !selectedBrand && (
            <Dropdown items={filtBrands} onSelect={pickBrand} query={brandQ} />
          )}
        </View>

        <Sep />

        {/* ── 02 MODEL ───────────────────────────────────────────────── */}
        <View style={s.section}>
          <StepHeader num="02" label="Model" done={!!selectedModel} />
          <SearchInput
            placeholder={selectedBrand ? `${selectedBrand.name} modeli ara…` : 'Önce marka seçin'}
            value={modelQ}
            onChangeText={(t) => { setModelQ(t); setModelOpen(true); setSelectedModel(null); }}
            onClear={clearModel}
            onFocus={() => { if (selectedBrand) setModelOpen(true); }}
            selected={!!selectedModel}
            disabled={!selectedBrand}
            loading={loadingModels}
          />
          {modelOpen && !selectedModel && selectedBrand && (
            <Dropdown items={filtModels} onSelect={pickModel} query={modelQ} />
          )}
        </View>

        <Sep />

        {/* ── 03 VERSİYON ────────────────────────────────────────────── */}
        {selectedModel && (
          <>
            <View style={s.section}>
              <View style={s.stepRow}>
                <StepHeader num="03" label="Versiyon" done={!!selectedTrim} />
                {loadingTrims && <ActivityIndicator size="small" color={C.gold} style={{ marginBottom: 14 }} />}
                {!loadingTrims && trims.length > 0 && (
                  <Text style={s.autoHint}>⚡ Seçince yakıt & vites otomatik dolar</Text>
                )}
              </View>

              {!loadingTrims && trims.length === 0 && (
                <View style={s.emptyCard}>
                  <Text style={s.emptyTitle}>Versiyon verisi bulunamadı</Text>
                  <Text style={s.emptySub}>Aşağıdan manuel giriş yapabilirsiniz.</Text>
                </View>
              )}

              <View style={s.trimList}>
                {trims.map(trim => (
                  <TrimCard
                    key={trim.id}
                    trim={trim}
                    selected={selectedTrim?.id === trim.id}
                    onPress={() => pickTrim(trim)}
                  />
                ))}
              </View>
            </View>
            <Sep />
          </>
        )}

        {/* ── 04 ARAÇ ADI ────────────────────────────────────────────── */}
        <View style={s.section}>
          <StepHeader num={selectedModel ? '04' : '03'} label="Araç Adı" done={vehicleName.trim().length > 0} />
          <TextInput
            style={s.nameInput}
            placeholder="Örn: Astra 1.4 Turbo"
            placeholderTextColor={C.textSoft}
            value={vehicleName}
            onChangeText={setVehicleName}
            autoCorrect={false}
          />
          <Text style={s.fieldNote}>Araç listenizde gösterilecek isim</Text>
        </View>

        <Sep />

        {/* ── 05 YAKIT & VİTES ───────────────────────────────────────── */}
        <View style={s.section}>
          <StepHeader num={selectedModel ? '05' : '04'} label="Yakıt & Vites" done={false} />

          <Text style={s.groupLabel}>Yakıt Tipi</Text>
          <View style={s.chipWrap}>
            {FUEL_TYPES.map(ft => (
              <FuelChip key={ft.value} value={ft.value} active={fuelType === ft.value} onPress={() => setFuelType(ft.value)} />
            ))}
          </View>

          <Text style={[s.groupLabel, { marginTop: 18 }]}>Vites Kutusu</Text>
          <View style={s.chipWrap}>
            {TX_TYPES.map(tx => (
              <TxChip key={tx.value} value={tx.value} active={transmission === tx.value} onPress={() => setTransmission(tx.value)} />
            ))}
          </View>
        </View>

        <Sep />

        {/* ── 06 TEKNİK BİLGİLER ────────────────────────────────────── */}
        <View style={s.section}>
          <StepHeader num={selectedModel ? '06' : '05'} label="Teknik Bilgiler" done={false} />
          <Text style={s.fieldNote}>İsteğe bağlı — yakıt hesaplama hassasiyetini artırır</Text>

          <View style={s.techRow}>
            {[
              { label: 'Motor Gücü (HP)', placeholder: '150', value: enginePower, setter: setEnginePower },
              { label: 'Motor Hacmi (cc)', placeholder: '1600', value: engineCap, setter: setEngineCap },
              { label: 'Ağırlık (kg)', placeholder: '1300', value: weight, setter: setWeight },
            ].map(field => (
              <View key={field.label} style={s.techGroup}>
                <Text style={s.techLabel}>{field.label}</Text>
                <TextInput
                  style={s.techInput}
                  placeholder={field.placeholder}
                  placeholderTextColor={C.textFaint}
                  value={field.value}
                  onChangeText={field.setter}
                  keyboardType="numeric"
                />
              </View>
            ))}
          </View>
        </View>

        {/* ── KAYDET ────────────────────────────────────────────────── */}
        <View style={s.footerWrap}>
          <TouchableOpacity
            style={[s.saveBtn, !canSave && s.saveBtnOff]}
            onPress={handleSave}
            activeOpacity={0.82}
            disabled={saving || !canSave}
          >
            {saving
              ? <ActivityIndicator color={C.bg} />
              : <Text style={[s.saveTxt, !canSave && s.saveTxtOff]}>Aracı Kaydet</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },

  // Loading
  loadWrap:  { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadTxt:   { fontSize: 14, color: C.textSoft },

  // Summary bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderMuted,
    backgroundColor: C.surface,
  },
  topBarTxt: { fontSize: 13, color: C.textSoft, fontWeight: '500', flex: 1 },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Sections
  section:  { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 20 },
  stepRow:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  autoHint: { fontSize: 11, color: C.gold, fontWeight: '600', marginBottom: 14 },

  // Empty trim state
  emptyCard:  { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 4 },
  emptySub:   { fontSize: 13, color: C.textSoft },

  trimList: { gap: 8 },

  // Name input
  nameInput: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1,
    borderColor: C.border, paddingHorizontal: 16, paddingVertical: 15,
    fontSize: 16, color: C.text, fontWeight: '500',
  },
  fieldNote: { fontSize: 12, color: C.textSoft, marginTop: 8 },

  // Chips
  groupLabel: { fontSize: 12, fontWeight: '700', color: C.textSoft, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  chipWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Tech specs
  techRow:   { flexDirection: 'row', gap: 8, marginTop: 16 },
  techGroup: { flex: 1 },
  techLabel: { fontSize: 11, color: C.textSoft, fontWeight: '600', marginBottom: 8, letterSpacing: 0.4 },
  techInput: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, paddingVertical: 13,
    fontSize: 16, color: C.text, fontWeight: '600',
    textAlign: 'center',
  },

  // Save
  footerWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  saveBtn: {
    backgroundColor: C.gold, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: C.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  saveBtnOff: { backgroundColor: C.card, shadowOpacity: 0 },
  saveTxt:    { fontSize: 17, fontWeight: '800', color: C.bg, letterSpacing: -0.3 },
  saveTxtOff: { color: C.textFaint },
});
