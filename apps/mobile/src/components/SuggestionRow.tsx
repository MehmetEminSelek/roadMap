import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'tamagui';

interface SuggestionRowProps {
  description: string;
  onPress: () => void;
}

export const SuggestionRow = React.memo(({ description, onPress }: SuggestionRowProps) => {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.dot} />
      <Text fontSize={14} color="#1C1C1E" flex={1} numberOfLines={2}>
        {description}
      </Text>
    </Pressable>
  );
});

SuggestionRow.displayName = 'SuggestionRow';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
});
