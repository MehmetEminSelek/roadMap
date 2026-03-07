import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MapPin, Clock, Trash2, ChevronRight, Heart, Route as RouteIcon } from 'lucide-react-native';
import { historyService } from '@/services/historyService';
import type { Route as RouteType } from '@/types/api';

export default function HistoryScreen() {
  const [routes, setRoutes] = useState<RouteType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadHistory(1, true);
    }, []),
  );

  const loadHistory = async (p: number = 1, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    }
    try {
      const result = await historyService.getAll(p, 20);
      const data = result?.data || [];
      if (reset) {
        setRoutes(data);
      } else {
        setRoutes((prev) => [...prev, ...data]);
      }
      setHasMore(p < (result?.meta?.lastPage || 0));
      setPage(p);
    } catch (err) {
      console.error('History load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadHistory(1, true);
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Sil', 'Bu rotayı silmek istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await historyService.delete(id);
            setRoutes((prev) => prev.filter((r) => r.id !== id));
          } catch (err: any) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const handleFavorite = async (route: RouteType) => {
    try {
      await historyService.addFavorite(route.id, `${route.origin} → ${route.destination}`);
      Alert.alert('Başarılı', 'Favorilere eklendi!');
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}s ${minutes}dk` : `${minutes}dk`;
  };

  const formatDistance = (meters: number): string => {
    return `${(meters / 1000).toFixed(0)} km`;
  };

  const formatCost = (amount: number) => {
    return `₺${Number(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#0A84FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Geçmiş Yolculuklar</Text>
        <Text style={styles.subtitle}>{routes.length} rota bulundu</Text>
      </View>

      {routes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <RouteIcon size={48} color="#8E8E93" strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Henüz rota yok</Text>
          <Text style={styles.emptySubtitle}>
            Hesapladığın tüm rotalar burada otomatik olarak kaydedilecek.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/search')}
          >
            <Text style={styles.emptyButtonText}>Yeni Rota Hesapla</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0A84FF" />
          }
          onEndReached={() => {
            if (hasMore) loadHistory(page + 1, false);
          }}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.routeCard}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/results',
                  params: {
                    routeId: item.id,
                    origin: item.origin,
                    destination: item.destination,
                    distance: String(item.distance),
                    duration: String(item.duration),
                    tollCost: String(item.tollCost),
                    fuelCost: String(item.fuelCost),
                    totalCost: String(item.totalCost),
                    routeCoordinates: item.routeCoordinates || '',
                    tollDetails: JSON.stringify(item.tollDetails || []),
                  },
                })
              }
            >
              <View style={styles.routeHeader}>
                <View style={styles.routeLocations}>
                  <Text style={styles.routeOrigin} numberOfLines={1}>{item.origin}</Text>
                  <Text style={styles.routeArrow}>→</Text>
                  <Text style={styles.routeDest} numberOfLines={1}>{item.destination}</Text>
                </View>
                <View style={styles.chevronWrapper}>
                  <ChevronRight size={18} color="#C7C7CC" />
                </View>
              </View>

              <View style={styles.routeDetails}>
                <View style={styles.detailChip}>
                  <MapPin size={14} color="#8E8E93" />
                  <Text style={styles.detailText}>{formatDistance(item.distance)}</Text>
                </View>
                <View style={[styles.detailChip, { marginLeft: 12 }]}>
                  <Clock size={14} color="#8E8E93" />
                  <Text style={styles.detailText}>{formatDuration(item.duration)}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <Text style={styles.totalCost}>{formatCost(item.totalCost)}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.routeFooter}>
                <Text style={styles.routeDate}>{formatDate(item.createdAt)}</Text>
                <View style={styles.routeActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleFavorite(item)}
                  >
                    <Heart size={20} color="#FF2D55" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { marginLeft: 16 }]}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Trash2 size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7', // iOS Light Gray Background
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 6,
  },
  listContent: {
    padding: 20,
    paddingBottom: 120, // Tab bar padding
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  routeLocations: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 16,
  },
  routeOrigin: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    flexShrink: 1,
  },
  routeArrow: {
    fontSize: 15,
    color: '#8E8E93',
    marginHorizontal: 8,
  },
  routeDest: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    flexShrink: 1,
  },
  chevronWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#1C1C1E',
    fontWeight: '500',
    marginLeft: 6,
  },
  totalCost: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A84FF',
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginVertical: 16,
  },
  routeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeDate: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  routeActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
