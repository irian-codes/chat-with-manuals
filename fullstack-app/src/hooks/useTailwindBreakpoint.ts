/* eslint-disable react-hooks/rules-of-hooks */
import {useEffect, useState} from 'react';
import type theme from 'tailwindcss/defaultTheme';

export const useTailwindBreakpoint = (
  query: keyof typeof theme.screens
): boolean => {
  // SSR check to ensure it only runs on the client
  if (typeof window === 'undefined') return false;

  const styles = getComputedStyle(document.documentElement);
  const screenWidth = styles.getPropertyValue(
    `--breakpoint-${query as string}`
  );

  const mediaQuery = `(min-width: ${screenWidth})`;
  const matchQueryList = window.matchMedia(mediaQuery);
  const [isMatch, setMatch] = useState<boolean>(false);
  const onChange = (e: MediaQueryListEvent) => setMatch(e.matches);

  useEffect(() => {
    setMatch(matchQueryList.matches);
    matchQueryList.addEventListener('change', onChange);
    return () => matchQueryList.removeEventListener('change', onChange);
  }, [matchQueryList, query]);

  return isMatch;
};
