/**
 * FuelPriceCarousel
 * ----------------------------------------------------------------
 * Yatay kaydırmalı yakıt fiyatı kartları (Shell, Opet, Petrol Ofisi, BP…).
 * Fiyatlar backend'den (`/fuel-prices/brands`) çekilir; tema + logo sabit
 * metadata olarak burada tutulur.
 *
 * Logoları eklerken `BRAND_META` içindeki ilgili entry'nin `logo` alanına
 * `require('@/assets/brands/shell.png')` ver.
 */
import { ScrollView, View, Text, StyleSheet, Image, ImageSourcePropType, Dimensions, ActivityIndicator } from 'react-native';
import { useFuelBrandPrices } from '@/queries/fuelPrices';
import type { BrandPriceSnapshot } from '@/services/fuelPriceService';
import { C } from '@/theme';

// ─── Marka görsel metadata'sı ────────────────────────────────────────────────

interface BrandTheme {
  bg: string;        // kart arkaplanı
  fg: string;        // ana yazı rengi
  sub: string;       // küçük etiket rengi
  accent: string;    // üst şerit / aksan
}

interface BrandMeta {
  theme: BrandTheme;
  logo?: ImageSourcePropType;
}

const BRAND_META: Record<string, BrandMeta> = {
  opet:  { theme: { bg: '#004B9B', fg: '#FFFFFF', sub: '#B9D0EA', accent: '#F9B000' } },
  shell: { theme: { bg: '#FBCE07', fg: '#1A1A1A', sub: '#5E4C00', accent: '#DD1D21' } },
  po:    { theme: { bg: '#E30613', fg: '#FFFFFF', sub: '#FFD3D6', accent: '#1A1A1A' } },
  bp:    { theme: { bg: '#007E33', fg: '#FFFFFF', sub: '#C9E6D0', accent: '#FFEF00' } },
};

const FALLBACK_META: BrandMeta = {
  theme: { bg: C.card, fg: C.text, sub: C.textSoft, accent: C.gold },
};

// ─── Kart boyutu ──────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(260, SCREEN_W * 0.72);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPrice = (v: number) =>
  v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  const days = Math.floor(hrs / 24);
  return `${days} gün önce`;
}

// ─── Tekil kart ───────────────────────────────────────────────────────────────

function BrandCard({ snapshot }: { snapshot: BrandPriceSnapshot }) {
  const meta = BRAND_META[snapshot.brandId] || FALLBACK_META;
  const { theme, logo } = meta;

  return (
    <View style={[s.card, { backgroundColor: theme.bg }]}>
      <View style={[s.accentStrip, { backgroundColor: theme.accent }]} />

      <View style={s.header}>
        <View style={[s.logoBox, { backgroundColor: `${theme.accent}22`, borderColor: `${theme.fg}18` }]}>
          {logo ? (
            <Image source={logo} style={s.logoImg} resizeMode="contain" />
          ) : (
            <Text style={[s.logoMono, { color: theme.fg }]}>{snapshot.brandName.charAt(0)}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.brandName, { color: theme.fg }]} numberOfLines={1}>
            {snapshot.brandName}
          </Text>
          <Text style={[s.brandSub, { color: theme.sub }]}>
            {snapshot.live ? relativeTime(snapshot.updatedAt) : 'canlı veri yok'}
          </Text>
        </View>
      </View>

      <View style={s.priceList}>
        {[
          { label: 'Benzin', value: snapshot.prices.petrol },
          { label: 'Dizel',  value: snapshot.prices.diesel },
          { label: 'LPG',    value: snapshot.prices.lpg },
        ].map((p, i, arr) => (
          <View key={p.label}>
            <View style={s.priceRow}>
              <Text style={[s.priceLabel, { color: theme.sub }]}>{p.label}</Text>
              <Text style={[s.priceValue, { color: theme.fg }]}>{formatPrice(p.value)}</Text>
            </View>
            {i < arr.length - 1 && (
              <View style={[s.divider, { backgroundColor: `${theme.fg}1A` }]} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

export function FuelPriceCarousel() {
  const { data, isLoading, isError } = useFuelBrandPrices();

  if (isLoading) {
    return (
      <View style={s.stateBox}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  if (isError || !data || data.length === 0) {
    return (
      <View style={s.stateBox}>
        <Text style={s.stateText}>Yakıt fiyatları şu an yüklenemedi.</Text>
      </View>
    );
  }

  // Live olanları öne al ki güncel fiyatlar kullanıcının ilk gördüğü olsun.
  const sorted = [...data].sort((a, b) => Number(b.live) - Number(a.live));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_W + 12}
      decelerationRate="fast"
      contentContainerStyle={s.scroll}
    >
      {sorted.map(snap => (
        <BrandCard key={snap.brandId} snapshot={snap} />
      ))}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    gap: 12,
    paddingVertical: 4,
  },

  stateBox: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  stateText: { fontSize: 13, color: C.textSoft, fontWeight: '500' },

  card: {
    width: CARD_W,
    borderRadius: 20,
    overflow: 'hidden',
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },

  accentStrip: { height: 4, width: '100%' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  logoBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  logoImg: { width: 32, height: 32 },
  logoMono: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  brandName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  brandSub: { fontSize: 11, fontWeight: '600', marginTop: 2, letterSpacing: 0.3 },

  priceList: { paddingHorizontal: 18, paddingTop: 4 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  divider: { height: 1, width: '100%' },
});
