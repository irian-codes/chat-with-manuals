/* eslint-disable react-hooks/rules-of-hooks */
import {useEffect, useState} from 'react';
import tailwindConfig from 'tailwind.config';
import resolveConfig from 'tailwindcss/resolveConfig';

const fullConfig = resolveConfig(tailwindConfig);
const {
  theme: {screens},
} = fullConfig;

const useTailwindBreakpoint = (query: keyof typeof screens): boolean => {
  // SSR check to ensure it only runs on the client
  if (typeof window === 'undefined') return false;

  const mediaQuery = `(min-width: ${screens[query]})`;
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

export default useTailwindBreakpoint;
