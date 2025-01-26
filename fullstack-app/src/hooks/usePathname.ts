import {useIsClient} from 'usehooks-ts';

export function usePathname() {
  const isClient = useIsClient();
  const pathname = isClient ? window.location.pathname : undefined;

  // Returning empty string because this way it's easier to consume in Typescript.
  // And anyways, it's only going to be used in the client so it's never going to be empty.
  return pathname ?? '';
}
