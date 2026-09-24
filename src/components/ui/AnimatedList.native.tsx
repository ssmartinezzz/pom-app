import { PropsWithChildren } from 'react';
import { View } from 'react-native';

interface Props {
  index: number;
}

export function AnimatedListItem({ children }: PropsWithChildren<Props>) {
  return <View>{children}</View>;
}
