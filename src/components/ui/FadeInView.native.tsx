import { PropsWithChildren } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

interface Props {
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

export function FadeInView({ children, style }: PropsWithChildren<Props>) {
  return <View style={style}>{children}</View>;
}
