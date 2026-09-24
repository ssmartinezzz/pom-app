import { PropsWithChildren } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface Props {
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

export function FadeInView({ children, style, duration = 300 }: PropsWithChildren<Props>) {
  return (
    <Animated.View entering={FadeIn.duration(duration)} style={style}>
      {children}
    </Animated.View>
  );
}
