import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { APP_CONFIG } from '../../config';
import { theme } from '../theme/theme';

export const FooterWatermark: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>built by {APP_CONFIG.brand}</Text>
    </View>
  );
};
 
const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  text: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
});