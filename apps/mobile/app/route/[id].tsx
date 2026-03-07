import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin, Car, Clock, Fuel, ChevronLeft, Heart, Trash2 } from 'lucide-react-native';
import { routeService } from '@/services/routeService';
import { historyService } from '@/services/historyService';
import type { Route } from '@/types/api';

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams();
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRoute();
  }, [id]);

  const loadRoute = async () => {
    try {
      const data = await routeService.getOne(id as string);
      setRoute(data);
    } catch (err: any) {
      setError(err.message || 'Rota bulunamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFavorite = async () => {
    if (!route) return;
    try {
      await historyService.addFavorite(route.id, `${route.origin} → ${route.destination}`);
      Alert.alert('Başarılı', 'Favorilere eklendi!');
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  };

  const handleDelete = () => {
    Alert.alert('Rotayı Sil', 'Bu rotayı silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await routeService.delete(id as string);
            router.back();
          } catch (err: any) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const formatCurrency = (amount: number) =>
    Number(amount).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} saat ${minutes} dk`;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error || !route) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error || 'Rota bulunamadı'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rota Detayı</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleAddFavorite} style={styles.headerBtn}>
            <Heart size={22} color="#FF3B30" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
            <Trash2 size={22} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.routeCard}>
        <View style={styles.routeRow}>
          <MapPin size={20} color="#007AFF" />
          <Text style={styles.routeText}>{route.origin}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.routeRow}>
          <MapPin size={20} color="#FF3B30" />
          <Text style={styles.routeText}>{route.destination}</Text>
        </View>
      </View>

      <View style={styles.costCard}>
        <View style={styles.costGrid}>
          <View style={styles.costItem}>
            <Text style={styles.costLabel}>Gişe</Text>
            <Text style={styles.costValue}>{formatCurrency(route.tollCost)}</Text>
          </View>
          <View style={styles.costItem}>
            <Text style={styles.costLabel}>Yakıt</Text>
            <Text style={styles.costValue}>{formatCurrency(route.fuelCost)}</Text>
          </View>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Toplam</Text>
          <Text style={styles.totalValue}>{formatCurrency(route.totalCost)}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Clock size={18} color="#8E8E93" />
          <Text style={styles.infoLabel}>Süre</Text>
          <Text style={styles.infoValue}>{formatDuration(route.duration)}</Text>
        </View>
        <View style={styles.infoRow}>
          <MapPin size={18} color="#8E8E93" />
          <Text style={styles.infoLabel}>Mesafe</Text>
          <Text style={styles.infoValue}>{(route.distance / 1000).toFixed(1)} km</Text>
        </View>
        {route.vehicle && (
          <>
            <View style={styles.infoRow}>
              <Car size={18} color="#8E8E93" />
              <Text style={styles.infoLabel}>Araç</Text>
              <Text style={styles.infoValue}>{route.vehicle.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Fuel size={18} color="#8E8E93" />
              <Text style={styles.infoLabel}>Yakıt</Text>
              <Text style={styles.infoValue}>{route.vehicle.fuelType}</Text>
            </View>
          </>
        )}
        <View style={styles.infoRow}>
          <Clock size={18} color="#8E8E93" />
          <Text style={styles.infoLabel}>Tarih</Text>
          <Text style={styles.infoValue}>{new Date(route.createdAt).toLocaleDateString('tr-TR')}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#FF3B30', marginBottom: 16 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#007AFF', borderRadius: 8 },
  backBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E' },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerBtn: { padding: 4 },
  routeCard: { margin: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  divider: { height: 24, width: 2, backgroundColor: '#E0E0E0', marginLeft: 9, marginVertical: 4 },
  costCard: { marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20 },
  costGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  costItem: { flex: 1, backgroundColor: '#F5F5F7', padding: 16, borderRadius: 12 },
  costLabel: { fontSize: 12, color: '#8E8E93', marginBottom: 4 },
  costValue: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E' },
  totalRow: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  infoCard: { margin: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  infoLabel: { fontSize: 14, color: '#8E8E93', flex: 1 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
});
