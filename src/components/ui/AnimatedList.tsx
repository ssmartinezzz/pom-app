import { PropsWithChildren } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

const MAX_ANIMATED = 10;

interface Props {
  index: number;
}

export function AnimatedListItem({ index, children }: PropsWithChildren<Props>) {
  const entering =
    index < MAX_ANIMATED
      ? FadeInDown.delay(index * 60).duration(300).springify()
      : undefined;

  return <Animated.View entering={entering}>{children}</Animated.View>;
}
