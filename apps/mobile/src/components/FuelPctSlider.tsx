/**
 * FuelPctSlider
 * ----------------------------------------------------------------
 * Native slider paketine ihtiyaç duymadan, PanResponder tabanlı yatay
 * yüzde slider'ı. Depodaki yakıt yüzdesini girmek için.
 */
import { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';

interface Props {
  value: number;                 // 0-100
  onChange: (v: number) => void;
  label?: string;
}

export function FuelPctSlider({ value, onChange, label = 'Başlangıç Depo Seviyesi' }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const pctRef = useRef(value);
  pctRef.current = value;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Grant: intentionally empty — ilk dokunuşta snap YAPMA.
        // Değer sadece kullanıcı sürüklediğinde (onPanResponderMove) değişir.
        // Aksi halde kullanıcı slider'ın soluna dokunup sürüklemeye başladığında
        // değer anında ~%10'a düşüyordu.
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX;
        const pct = clamp(Math.round((x / Math.max(trackWidthRef.current, 1)) * 100));
        onChangeRef.current(pct);
      },
    }),
  ).current;

  // onChange stabil referans için
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const trackWidthRef = useRef(0);
  trackWidthRef.current = trackWidth;

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const fillPct = clamp(value);
  const thumbLeft = (fillPct / 100) * trackWidth;

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.value}>%{fillPct}</Text>
      </View>
      <View style={s.track} onLayout={onLayout} {...pan.panHandlers}>
        <View style={[s.fill, { width: `${fillPct}%` }]} />
        {trackWidth > 0 && (
          <View style={[s.thumb, { left: thumbLeft - 12 }]} />
        )}
      </View>
      <View style={s.rowBetween}>
        <Text style={s.endLabel}>Boş</Text>
        <Text style={s.endLabel}>Dolu</Text>
      </View>
    </View>
  );
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 4, paddingVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  label: { fontSize: 12, color: '#6B7280', fontWeight: '600', letterSpacing: 0.3 },
  value: { fontSize: 15, color: '#0A84FF', fontWeight: '800' },
  track: {
    height: 28,
    marginTop: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 14,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    backgroundColor: '#0A84FF',
    borderRadius: 14,
  },
  thumb: {
    position: 'absolute',
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#0A84FF',
    top: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  endLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
});
