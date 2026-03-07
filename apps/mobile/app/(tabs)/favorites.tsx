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
import { Heart, Trash2, Route as RouteIcon, Navigation } from 'lucide-react-native';
import { favoritesService } from '@/services/favoritesService';
import type { FavoriteRoute } from '@/types/api';

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

  const formatCost = (amount: number) => `₺${Number(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(0)} km`;

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
        <Text style={styles.title}>Favori Rotalar</Text>
        <Text style={styles.subtitle}>{favorites.length} kayıtlı rota</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Heart size={48} color="#FF2D55" strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Favori rotanız yok</Text>
          <Text style={styles.emptySubtitle}>
            Sık kullandığınız veya sevdiğiniz rotaları hesaplama sonucundan buraya ekleyebilirsiniz.
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0A84FF" />
          }
          renderItem={({ item }) => (
            <View style={styles.favoriteCard}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16 }}>
                  <Heart size={20} color="#FF2D55" fill="#FF2D55" />
                  <Text style={styles.favoriteName} numberOfLines={1}>{item.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemove(item.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Trash2 size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>

              {item.route && (
                <View style={styles.routeInfoCard}>
                  <View style={styles.routeHeader}>
                    <View style={styles.routeDot} />
                    <Text style={styles.routeText} numberOfLines={1}>{item.route.origin}</Text>
                  </View>
                  <View style={styles.routeLine} />
                  <View style={styles.routeHeader}>
                    <View style={[styles.routeDot, { backgroundColor: '#0A84FF', borderColor: '#0A84FF' }]} />
                    <Text style={styles.routeText} numberOfLines={1}>{item.route.destination}</Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.routeStats}>
                    <View style={styles.statChip}>
                      <Navigation size={14} color="#8E8E93" />
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
    backgroundColor: '#F2F2F7',
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
  favoriteCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  favoriteName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 10,
    flexShrink: 1,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeInfoCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 16,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    backgroundColor: '#FFFFFF',
    marginRight: 12,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#E5E5EA',
    marginLeft: 4,
    marginVertical: 4,
  },
  routeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 16,
  },
  routeStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statText: {
    fontSize: 13,
    color: '#1C1C1E',
    fontWeight: '500',
    marginLeft: 6,
  },
  statCost: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
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
    backgroundColor: '#FFF0F0',
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
  },
});
