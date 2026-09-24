import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing } from '../theme';

interface Props {
  languageName: string;
  size?: number;
}

const LANG_CONFIG: Record<string, { label: string; color: string; icon?: keyof typeof Ionicons.glyphMap }> = {
  python: { label: 'Py', color: '#3776AB', icon: 'logo-python' },
  java: { label: 'Jv', color: '#ED8B00' },
};

function normalize(name: string): string {
  return name.toLowerCase().trim();
}

export const LanguageIcon = memo(function LanguageIcon({ languageName, size = 24 }: Props) {
  const key = normalize(languageName);
  const config = LANG_CONFIG[key];

  if (!config) {
    return (
      <View style={[styles.badge, { width: size, height: size, backgroundColor: colors.bgTertiary }]}>
        <Text style={[styles.badgeText, { fontSize: size * 0.45 }]}>?</Text>
      </View>
    );
  }

  // Python has an Ionicons logo
  if (config.icon) {
    return <Ionicons name={config.icon} size={size} color={config.color} />;
  }

  // Others: colored text badge
  return (
    <View style={[styles.badge, { width: size, height: size, backgroundColor: config.color + '20', borderColor: config.color + '40' }]}>
      <Text style={[styles.badgeText, { fontSize: size * 0.4, color: config.color }]}>{config.label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});
