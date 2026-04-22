/**
 * FuelPctSlider
 * ----------------------------------------------------------------
 * Native slider paketine ihtiyaç duymadan, PanResponder tabanlı yatay
 * yüzde slider'ı. Depodaki yakıt yüzdesini girmek için.
 *
 * Önceki implementasyon `e.nativeEvent.locationX` kullanıyordu; bu parmağın
 * track'in sol kenarına göre göreceli pozisyonu ama RN'de sürükleme
 * sırasında tutarsız okunabiliyor (özellikle parmak track'in dışına çıkıp
 * geri geldiğinde ya da modal içinde kullanıldığında `locationX` saçma
 * değerler dönüyor). Çözüm: track'in ekrandaki mutlak X konumunu `measure`
 * ile al, sonra `pageX - trackPageX` ile local pozisyonu hesapla.
 */
import { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';

interface Props {
  value: number;                 // 0-100
  onChange: (v: number) => void;
  label?: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function FuelPctSlider({ value, onChange, label = 'Başlangıç Depo Seviyesi' }: Props) {
  const trackRef = useRef<View | null>(null);

  // Track'in ekran üzerindeki konumu + genişliği — measure ile her dokunuşta
  // yenileniyor (modal/scroll pozisyonu değişebilir).
  const trackPageXRef = useRef(0);
  const trackWidthRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0); // thumb rendering için

  // onChange stabil referans — PanResponder.create closure'u içinden çağrı.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const measureTrack = () => {
    trackRef.current?.measure?.((_x, _y, w, _h, px) => {
      trackPageXRef.current = px;
      trackWidthRef.current = w;
    });
  };

  // Component mount sonrası bir kez measure et — initial render için
  useEffect(() => {
    // Bir tick gecikme: react-native iOS'ta Modal içindeki measure'ın
    // stabilleşmesi için gerekli.
    const id = setTimeout(measureTrack, 0);
    return () => clearTimeout(id);
  }, []);

  const computePct = (pageX: number): number => {
    const w = trackWidthRef.current;
    if (w <= 0) return 0;
    const localX = pageX - trackPageXRef.current;
    return clamp(Math.round((localX / w) * 100));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Her dokunuşta measure — modal/scroll sırasında pozisyon kayabilir.
        // Değeri DEĞİŞTİRMİYORUZ; kullanıcı sadece dokundu diye %5'e atlamasın.
        measureTrack();
      },
      onPanResponderMove: (e) => {
        onChangeRef.current(computePct(e.nativeEvent.pageX));
      },
      onPanResponderRelease: (e) => {
        // Son bir update — bazen move son pozisyonu yakalayamıyor.
        onChangeRef.current(computePct(e.nativeEvent.pageX));
      },
    }),
  ).current;

  const fillPct = clamp(value);
  const thumbLeft = (fillPct / 100) * trackWidth;

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.value}>%{fillPct}</Text>
      </View>
      <View
        ref={trackRef}
        style={s.track}
        onLayout={(e) => {
          setTrackWidth(e.nativeEvent.layout.width);
          // onLayout yeterince erken çağrıldığı için burada da measure tetikle
          measureTrack();
        }}
        {...pan.panHandlers}
      >
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
