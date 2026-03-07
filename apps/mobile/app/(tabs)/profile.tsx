import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { User, Car, LogOut, ChevronRight, Shield, Info } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
    const { user, logout } = useAuth();

    const menuItems = [
        {
            icon: Car,
            label: 'Araçlarım',
            color: '#4285F4',
            onPress: () => router.push('/vehicles/'),
        },
        {
            icon: Shield,
            label: 'Gizlilik & Güvenlik',
            color: '#34A853',
            onPress: () => { },
        },
        {
            icon: Info,
            label: 'Hakkında',
            color: '#5F6368',
            onPress: () => { },
        },
    ];

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
        >
            {/* Profile Header */}
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </Text>
                </View>
                <Text style={styles.name}>{user?.name || 'Kullanıcı'}</Text>
                <Text style={styles.email}>{user?.email || ''}</Text>
            </View>

            {/* Menu Items */}
            <View style={styles.menuSection}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.menuItem}
                        onPress={item.onPress}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                            <item.icon size={20} color={item.color} />
                        </View>
                        <Text style={styles.menuLabel}>{item.label}</Text>
                        <ChevronRight size={18} color="#C7C7CC" />
                    </TouchableOpacity>
                ))}
            </View>

            {/* Logout */}
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <LogOut size={20} color="#EA4335" />
                <Text style={styles.logoutText}>Çıkış Yap</Text>
            </TouchableOpacity>

            <Text style={styles.version}>RoadMap v1.0.0</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F7',
    },
    contentContainer: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 20,
        backgroundColor: '#FFFFFF',
        marginBottom: 16,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#4285F4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    name: {
        fontSize: 22,
        fontWeight: '700',
        color: '#202124',
        marginBottom: 4,
    },
    email: {
        fontSize: 14,
        color: '#5F6368',
    },
    menuSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 24,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F3F4',
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
        color: '#202124',
        fontWeight: '500',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        marginHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#EA4335',
    },
    version: {
        textAlign: 'center',
        fontSize: 12,
        color: '#9AA0A6',
        marginTop: 24,
    },
});
