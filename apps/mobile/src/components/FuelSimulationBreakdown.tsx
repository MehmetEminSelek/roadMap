/**
 * FuelSimulationBreakdown
 * ----------------------------------------------------------------
 * Results sayfasında "İkmal Durakları" kartı. Her stop bir row:
 *   - Marka + il adı
 *   - @km
 *   - litre + TL
 *
 * fuelSimulation.warnings varsa üstte ince uyarı banner'ı.
 */
import { View, Text, StyleSheet } from 'react-native';
import { Fuel, AlertTriangle, MapPin } from 'lucide-react-native';
import type { FuelSimulation } from '@/types/api';

const BRAND_LABELS: Record<string, string> = {
  opet: 'Opet', shell: 'Shell', po: 'Petrol Ofisi', bp: 'BP',
};

const BRAND_COLORS: Record<string, string> = {
  opet: '#004B9B', shell: '#FBCE07', po: '#E30613', bp: '#007E33',
};

interface Props {
  sim: FuelSimulation;
}

export function FuelSimulationBreakdown({ sim }: Props) {
  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.headerIcon}>
          <Fuel size={18} color="#0A84FF" />
        </View>
        <Text style={s.headerTitle}>İkmal Durakları</Text>
      </View>

      {sim.warnings.length > 0 && (
        <View style={s.warnBox}>
          <AlertTriangle size={14} color="#B45309" />
          <Text style={s.warnText}>{sim.warnings[0]}</Text>
        </View>
      )}

      {sim.stops.length === 0 ? (
        <Text style={s.emptyText}>
          Bu rotada yakıt almanıza gerek yok. Varışta tankta %{Math.round(sim.endingFuelPct)} kalıyor.
        </Text>
      ) : (
        <>
          {sim.stops.map((stop, i) => (
            <View key={i} style={s.row}>
              <View style={[s.brandDot, { backgroundColor: BRAND_COLORS[stop.brandId] || '#8E8E93' }]} />
              <View style={{ flex: 1 }}>
                <View style={s.rowTop}>
                  <MapPin size={12} color="#6B7280" />
                  <Text style={s.province}>{stop.provinceName}</Text>
                  <Text style={s.brandName}>· {BRAND_LABELS[stop.brandId] || stop.brandId}</Text>
                  <Text style={s.atKm}>@ {stop.atKm.toFixed(0)} km</Text>
                </View>
                <Text style={s.subline}>
                  {stop.litersPurchased.toFixed(1)} L × {stop.pricePerLiter.toFixed(2)} ₺
                </Text>
              </View>
              <Text style={s.cost}>{stop.cost.toFixed(0)} ₺</Text>
            </View>
          ))}

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Toplam Yakıt</Text>
            <Text style={s.totalVal}>
              {sim.totalLitersPurchased.toFixed(1)} L · {sim.totalFuelCost.toFixed(0)} ₺
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  headerIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#EEF4FF',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.2 },
  warnBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, marginBottom: 10,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1, borderColor: '#FED7AA',
  },
  warnText: { flex: 1, fontSize: 12, color: '#9A3412', fontWeight: '500' },
  emptyText: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  brandDot: { width: 4, height: 32, borderRadius: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  province: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  brandName: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  atKm: { marginLeft: 'auto', fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  subline: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  cost: { fontSize: 14, fontWeight: '800', color: '#0A84FF', fontVariant: ['tabular-nums'] },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, marginTop: 4,
  },
  totalLabel: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  totalVal: { fontSize: 14, fontWeight: '800', color: '#0A84FF', fontVariant: ['tabular-nums'] },
});
