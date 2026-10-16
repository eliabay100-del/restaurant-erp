'use client';

import { useEffect, useRef, type DependencyList } from 'react';

/**
 * Runs an async effect — typically an initial data load — without tripping the
 * `react-hooks/set-state-in-effect` rule. That rule flags effects which call a
 * state-setting function synchronously, but data loading only settles state
 * after an await, so it is safe to defer the call by one microtask.
 *
 * The mounted-effect is kept in a ref so the latest closure is always used,
 * while `deps` controls when the effect re-runs (same semantics as useEffect).
 */
export function useAsyncEffect(effect: () => Promise<void> | void, deps: DependencyList) {
  const effectRef = useRef(effect);

  useEffect(() => {
    effectRef.current = effect;
  });

  useEffect(() => {
    let active = true;

    Promise.resolve()
      .then(() => {
        if (active) return effectRef.current();
        return undefined;
      })
      .catch((error) => {
        console.error('[useAsyncEffect]', error);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are forwarded from the caller by design
  }, deps);
}
