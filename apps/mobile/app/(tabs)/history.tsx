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
import { C } from '@/theme';

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
    if (reset) setLoading(true);
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

  const formatDistance = (meters: number): string => `${(meters / 1000).toFixed(0)} km`;

  const formatCost = (amount: number) =>
    `₺${Number(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Geçmiş Yolculuklar</Text>
        <Text style={styles.subtitle}>{routes.length} rota bulundu</Text>
      </View>

      {routes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <RouteIcon size={40} color={C.textSoft} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Henüz rota yok</Text>
          <Text style={styles.emptySubtitle}>
            Hesapladığın tüm rotalar burada otomatik olarak kaydedilecek.
          </Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={C.gold}
            />
          }
          onEndReached={() => {
            if (hasMore) loadHistory(page + 1, false);
          }}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.routeCard}
              onPress={() =>
                router.push({ pathname: '/route/[id]', params: { id: item.id } })
              }
            >
              {/* Route title */}
              <View style={styles.routeHeader}>
                <View style={styles.routeLocations}>
                  <Text style={styles.routeOrigin} numberOfLines={1}>{item.origin}</Text>
                  <Text style={styles.routeArrow}>→</Text>
                  <Text style={styles.routeDest} numberOfLines={1}>{item.destination}</Text>
                </View>
                <View style={styles.chevronWrapper}>
                  <ChevronRight size={16} color={C.textSoft} />
                </View>
              </View>

              {/* Stats row */}
              <View style={styles.routeDetails}>
                <View style={styles.detailChip}>
                  <MapPin size={13} color={C.textSoft} />
                  <Text style={styles.detailText}>{formatDistance(item.distance)}</Text>
                </View>
                <View style={[styles.detailChip, { marginLeft: 10 }]}>
                  <Clock size={13} color={C.textSoft} />
                  <Text style={styles.detailText}>{formatDuration(item.duration)}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <Text style={styles.totalCost}>{formatCost(item.totalCost)}</Text>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Footer */}
              <View style={styles.routeFooter}>
                <Text style={styles.routeDate}>{formatDate(item.createdAt)}</Text>
                <View style={styles.routeActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleFavorite(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Heart size={18} color="#FF2D55" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { marginLeft: 16 }]}
                    onPress={() => handleDelete(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={18} color={C.danger} />
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
    backgroundColor: C.bg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: C.textSoft,
    fontWeight: '500',
    marginTop: 4,
  },

  // ── List
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },

  // ── Route Card
  routeCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  routeLocations: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
    flexShrink: 1,
  },
  routeOrigin: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    flexShrink: 1,
  },
  routeArrow: {
    fontSize: 14,
    color: C.textSoft,
    marginHorizontal: 8,
  },
  routeDest: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    flexShrink: 1,
  },
  chevronWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  // ── Detail chips
  routeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  detailText: {
    fontSize: 12,
    color: C.text,
    fontWeight: '500',
    marginLeft: 5,
  },
  totalCost: {
    fontSize: 19,
    fontWeight: '800',
    color: C.gold,
    letterSpacing: -0.4,
  },

  // ── Footer
  divider: {
    height: 1,
    backgroundColor: C.borderMuted,
    marginVertical: 14,
  },
  routeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeDate: {
    fontSize: 12,
    color: C.textSoft,
    fontWeight: '500',
  },
  routeActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 4,
  },

  // ── Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconBox: {
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
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: C.textSoft,
    textAlign: 'center',
    lineHeight: 22,
  },
});
