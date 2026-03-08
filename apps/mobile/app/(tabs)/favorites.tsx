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
import { useFocusEffect } from 'expo-router';
import { Heart, Trash2, Navigation } from 'lucide-react-native';
import { favoritesService } from '@/services/favoritesService';
import type { FavoriteRoute } from '@/types/api';
import { C } from '@/theme';

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, []),
  );

  const loadFavorites = async () => {
    try {
      const data = await favoritesService.getRoutes();
      setFavorites(data || []);
    } catch (err) {
      console.error('Favorites load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  const handleRemove = async (id: string) => {
    Alert.alert('Kaldır', 'Bu rotayı favorilerden kaldırmak istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: async () => {
          try {
            await favoritesService.removeRoute(id);
            setFavorites((prev) => prev.filter((f) => f.id !== id));
          } catch (err: any) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const formatCost = (amount: number) =>
    `₺${Number(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(0)} km`;

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
        <Text style={styles.title}>Favori Rotalar</Text>
        <Text style={styles.subtitle}>{favorites.length} kayıtlı rota</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Heart size={40} color="#FF2D55" strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Favori rotanız yok</Text>
          <Text style={styles.emptySubtitle}>
            Sık kullandığınız rotaları hesaplama sonucundan favorilere ekleyebilirsiniz.
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.gold} />
          }
          renderItem={({ item }) => (
            <View style={styles.favoriteCard}>
              {/* Card header: name + remove button */}
              <View style={styles.cardHeader}>
                <View style={styles.namePill}>
                  <Heart size={14} color="#FF2D55" fill="#FF2D55" />
                  <Text style={styles.favoriteName} numberOfLines={1}>{item.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemove(item.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Trash2 size={16} color={C.danger} />
                </TouchableOpacity>
              </View>

              {/* Route info */}
              {item.route && (
                <View style={styles.routeInfoCard}>
                  {/* Origin */}
                  <View style={styles.routeRow}>
                    <View style={[styles.routeDot, { backgroundColor: C.success }]} />
                    <Text style={styles.routeText} numberOfLines={1}>{item.route.origin}</Text>
                  </View>
                  {/* Connector */}
                  <View style={styles.routeConnector}>
                    <View style={styles.routeLine} />
                  </View>
                  {/* Destination */}
                  <View style={styles.routeRow}>
                    <View style={[styles.routeDot, { backgroundColor: C.danger }]} />
                    <Text style={styles.routeText} numberOfLines={1}>{item.route.destination}</Text>
                  </View>

                  <View style={styles.divider} />

                  {/* Stats */}
                  <View style={styles.routeStats}>
                    <View style={styles.statChip}>
                      <Navigation size={13} color={C.textSoft} />
                      <Text style={styles.statText}>{formatDistance(item.route.distance)}</Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.statCost}>{formatCost(item.route.totalCost)}</Text>
                  </View>
                </View>
              )}
            </View>
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

  // ── Favorite Card
  favoriteCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  namePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 12,
  },
  favoriteName: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    flexShrink: 1,
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.dangerSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Route info card (nested)
  routeInfoCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borderMuted,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeConnector: {
    paddingLeft: 4,
    paddingVertical: 3,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: C.border,
    marginLeft: 0,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '500',
    color: C.text,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 12,
  },
  routeStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  statText: {
    fontSize: 12,
    color: C.text,
    fontWeight: '500',
  },
  statCost: {
    fontSize: 18,
    fontWeight: '800',
    color: C.gold,
    letterSpacing: -0.4,
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
