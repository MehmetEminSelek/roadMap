import { createAnimations } from '@tamagui/animations-react-native'
import { config } from '@tamagui/config/v3'
import { createTamagui } from 'tamagui'

export const tamaguiConfig = createTamagui({
  ...config,
  animations: createAnimations({
    fast:   { type: 'spring', damping: 20, mass: 1.2, stiffness: 250 },
    medium: { type: 'spring', damping: 10, mass: 0.9, stiffness: 100 },
    slow:   { type: 'spring', damping: 20, stiffness: 60 },
    bouncy: { type: 'spring', damping: 9,  mass: 0.9, stiffness: 150 },
    lazy:   { type: 'spring', damping: 18, stiffness: 50 },
  }),
})

export default tamaguiConfig
export type Conf = typeof tamaguiConfig
declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}
