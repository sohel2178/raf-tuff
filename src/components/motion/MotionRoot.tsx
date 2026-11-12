'use client';

import { LazyMotion, MotionConfig } from 'framer-motion';

const loadFeatures = () => import('@/lib/motionFeatures').then((mod) => mod.default);

/** One place for the motion engine: lazily loaded, and off for people who ask for reduced motion. */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
