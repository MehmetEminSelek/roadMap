import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Car, LogOut, ChevronRight, Shield, Info } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { C } from '@/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const menuItems = [
    {
      icon: Car,
      label: 'Araçlarım',
      accent: C.gold,
      onPress: () => router.push('/vehicles/'),
    },
    {
      icon: Shield,
      label: 'Gizlilik & Güvenlik',
      accent: C.success,
      onPress: () => {},
    },
    {
      icon: Info,
      label: 'Hakkında',
      accent: C.textSoft,
      onPress: () => {},
    },
  ];

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile Hero ───────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <Text style={styles.name}>{user?.name || 'Kullanıcı'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>
      </View>

      {/* ── Menu Section ───────────────────────────── */}
      <View style={styles.menuSection}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.menuItem,
              index < menuItems.length - 1 && styles.menuItemBorder,
            ]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${item.accent}18` }]}>
              <item.icon size={19} color={item.accent} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <ChevronRight size={17} color={C.textSoft} />
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Logout ─────────────────────────────────── */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.75}>
        <LogOut size={18} color={C.danger} />
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>

      <Text style={styles.version}>RoadMap v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  contentContainer: {
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingBottom: 120,
  },

  // ── Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 24,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    padding: 3,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
    backgroundColor: C.goldSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: C.gold,
    letterSpacing: -0.5,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 14,
    color: C.textSoft,
  },

  // ── Menu
  menuSection: {
    backgroundColor: C.card,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.borderMuted,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    color: C.text,
    fontWeight: '500',
  },

  // ── Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginHorizontal: 16,
    backgroundColor: C.dangerSubtle,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.18)',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: C.danger,
  },

  // ── Version
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: C.textFaint,
    marginTop: 24,
  },
});
