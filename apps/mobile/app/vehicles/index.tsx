import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Car, Plus, Trash2, Edit3, ChevronLeft } from 'lucide-react-native';
import { vehicleService } from '@/services/vehicleService';
import type { Vehicle } from '@/types/api';
import { C } from '@/theme';

const FUEL_LABELS: Record<string, string> = {
  PETROL: 'Benzin',
  DIZEL: 'Dizel',
  HYBRID: 'Hibrit',
  ELECTRIC: 'Elektrik',
  LPG: 'LPG',
};

export default function VehiclesScreen() {
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await vehicleService.getAll();
      setVehicles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Aracı Sil', `"${name}" aracını silmek istediğinize emin misiniz?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await vehicleService.delete(id);
            setVehicles((prev) => prev.filter((v) => v.id !== id));
          } catch (err: any) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Araçlarım</Text>
        <View style={{ width: 40 }} />
      </View>

      {vehicles.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Car size={40} color={C.textSoft} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Henüz araç eklemediniz</Text>
          <Text style={styles.emptySubtitle}>
            Araç bilgilerinizi ekleyerek daha doğru yakıt ve maliyet hesaplaması yapın.
          </Text>
          <TouchableOpacity
            style={styles.addButtonPrimary}
            onPress={() => router.push('/vehicles/add')}
          >
            <Plus size={18} color="#090909" />
            <Text style={styles.addButtonText}>Araç Ekle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={vehicles}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                tintColor={C.gold}
              />
            }
            renderItem={({ item }) => {
              const fuelColor = C.fuel[item.fuelType] || C.textSoft;
              return (
                <View style={styles.vehicleCard}>
                  <View style={[styles.fuelStrip, { backgroundColor: fuelColor }]} />
                  <View style={styles.cardBody}>
                    <View style={[styles.iconBox, { backgroundColor: `${fuelColor}18` }]}>
                      <Car size={22} color={fuelColor} />
                    </View>
                    <View style={styles.vehicleInfo}>
                      <Text style={styles.vehicleName}>{item.name}</Text>
                      <Text style={styles.vehicleSub}>{item.brand} {item.model}</Text>
                      <View style={styles.tags}>
                        <View style={[styles.tag, { backgroundColor: `${fuelColor}15`, borderColor: `${fuelColor}30` }]}>
                          <Text style={[styles.tagText, { color: fuelColor }]}>
                            {FUEL_LABELS[item.fuelType] || item.fuelType}
                          </Text>
                        </View>
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>{item.enginePower} HP</Text>
                        </View>
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>
                            {item.transmission === 'AUTOMATIC' ? 'Otomatik'
                              : item.transmission === 'MANUAL' ? 'Manuel'
                              : item.transmission}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.actions}>
                      <TouchableOpacity
                        onPress={() => router.push(`/vehicles/${item.id}`)}
                        style={styles.actionBtn}
                      >
                        <Edit3 size={17} color={C.gold} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(item.id, item.name)}
                        style={styles.actionBtn}
                      >
                        <Trash2 size={17} color={C.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
          />
          <TouchableOpacity
            style={[styles.fab, { bottom: insets.bottom + 24 }]}
            onPress={() => router.push('/vehicles/add')}
          >
            <Plus size={26} color="#090909" />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  backBtn: { padding: 8 },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  vehicleCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fuelStrip: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: 2,
  },
  vehicleSub: {
    fontSize: 13,
    color: C.textSoft,
    marginBottom: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: C.textSoft,
    fontWeight: '600',
  },
  actions: {
    gap: 10,
  },
  actionBtn: { padding: 6 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: C.textSoft,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 32,
  },
  addButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.gold,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  addButtonText: {
    color: '#090909',
    fontSize: 16,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
});
