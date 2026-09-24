import { PropsWithChildren, useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

interface Props extends PressableProps {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

export function AnimatedPressable({
  children,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PropsWithChildren<Props>) {
  const opacity = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        Animated.timing(opacity, { toValue: 0.7, duration: 100, useNativeDriver: true }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[{ opacity }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
