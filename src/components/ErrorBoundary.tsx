import { Component, PropsWithChildren } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui';
import { colors, fonts, spacing } from '../theme';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    if (Platform.OS === 'web') {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null });
    }
  };

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || 'Unknown error';
      return (
        <View style={styles.container}>
          <Ionicons name="bug-outline" size={64} color={colors.danger} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            An unexpected error occurred. Please try again.
          </Text>
          <Text style={styles.errorMsg} numberOfLines={3}>{msg}</Text>
          <Button title="Reload" onPress={this.handleRetry} />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fonts.sizes.xl,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
  },
  errorMsg: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
