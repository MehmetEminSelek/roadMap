import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

/**
 * Kullanici konumunu expo-location ile alir.
 * Permission denied / hata durumunda null doner (sessizce).
 * enabled=false gecilirse hic istemez.
 */
export function useUserLocation(enabled: boolean = true) {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setPermissionDenied(true);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch {
        // network/hardware hatasi - sessizce yut
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { location, permissionDenied };
}
