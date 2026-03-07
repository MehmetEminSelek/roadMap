import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Car, Plus, Trash2, Edit3 } from 'lucide-react-native';
import { vehicleService } from '@/services/vehicleService';
import type { Vehicle } from '@/types/api';

export default function VehiclesScreen() {
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
            setVehicles(prev => prev.filter(v => v.id !== id));
          } catch (err: any) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const fuelTypeLabel: Record<string, string> = {
    PETROL: 'Benzin',
    DIZEL: 'Dizel',
    HYBRID: 'Hibrit',
    ELECTRIC: 'Elektrik',
    LPG: 'LPG',
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {vehicles.length === 0 ? (
        <View style={styles.emptyState}>
          <Car size={64} color="#E0E0E0" />
          <Text style={styles.emptyText}>Henüz araç eklemediniz</Text>
          <TouchableOpacity style={styles.addButtonPrimary} onPress={() => router.push('/vehicles/add')}>
            <Text style={styles.addButtonPrimaryText}>Araç Ekle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={vehicles}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
            renderItem={({ item }) => (
              <View style={styles.vehicleCard}>
                <View style={styles.vehicleMain}>
                  <Text style={styles.vehicleName}>{item.name}</Text>
                  <Text style={styles.vehicleDetails}>
                    {item.brand} {item.model}
                  </Text>
                  <View style={styles.tags}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{fuelTypeLabel[item.fuelType] || item.fuelType}</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{item.enginePower} HP</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{item.transmission}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => router.push(`/vehicles/${item.id}`)} style={styles.actionBtn}>
                    <Edit3 size={18} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.actionBtn}>
                    <Trash2 size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          <TouchableOpacity style={styles.fab} onPress={() => router.push('/vehicles/add')}>
            <Plus size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#8E8E93', marginTop: 16, marginBottom: 24 },
  addButtonPrimary: { backgroundColor: '#007AFF', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  addButtonPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  vehicleCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  vehicleMain: { flex: 1 },
  vehicleName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  vehicleDetails: { fontSize: 14, color: '#8E8E93', marginBottom: 8 },
  tags: { flexDirection: 'row', gap: 6 },
  tag: { backgroundColor: '#F0F0F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 11, color: '#666', fontWeight: '500' },
  actions: { justifyContent: 'center', gap: 12 },
  actionBtn: { padding: 6 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
});
