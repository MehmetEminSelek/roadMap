import { Tabs } from 'expo-router';
import { Platform, TouchableOpacity, View, StyleSheet } from 'react-native';
import { LayoutDashboard, Clock, Heart, User, Navigation } from 'lucide-react-native';
import { C } from '@/theme';

function CenterTabButton({ onPress }: { onPress?: (...args: any[]) => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.centerWrap}>
      <View style={styles.centerBtn}>
        <Navigation size={26} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.gold,
        tabBarInactiveTintColor: C.textFaint,
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 24 : 12,
          left: 20,
          right: 20,
          backgroundColor: C.surface,
          borderRadius: 24,
          height: 64,
          paddingBottom: 0,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: C.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
          marginBottom: 6,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Özet',
          tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Geçmiş',
          tabBarIcon: ({ color }) => <Clock color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="calculate"
        options={{
          title: '',
          tabBarButton: (props) => <CenterTabButton onPress={props.onPress ?? undefined} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favoriler',
          tabBarIcon: ({ color }) => <Heart color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <User color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  centerBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
});
