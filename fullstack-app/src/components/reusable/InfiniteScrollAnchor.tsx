import {
  useDebounceCallback,
  useIntersectionObserver,
  useIsClient,
} from 'usehooks-ts';

interface InfiniteScrollAnchorProps {
  isLoading: boolean;
  hasMoreItems: boolean;
  runOnClientOnly?: boolean;
  observerOptions: Omit<
    NonNullable<Parameters<typeof useIntersectionObserver>[0]>,
    'onChange'
  >;
  /**
   * A memoized callback function that is called when the intersection
   * changes. This should be passed using React.useCallback, otherwise the
   * debounce will act as a delay (not a debounce).
   */
  memoizedOnChange: NonNullable<
    NonNullable<Parameters<typeof useIntersectionObserver>[0]>['onChange']
  >;
  children?: React.ReactNode;
  debounceInMs?: number;
}

export function InfiniteScrollAnchor(props: InfiniteScrollAnchorProps) {
  const isClient = useIsClient();
  const debouncedOnChange = useDebounceCallback(
    props.memoizedOnChange,
    props.debounceInMs
  );

  const {ref} = useIntersectionObserver({
    ...props.observerOptions,
    onChange: (isIntersecting, entry) => {
      if (props.runOnClientOnly && !isClient) {
        return;
      }

      if (!props.isLoading && props.hasMoreItems) {
        return debouncedOnChange(isIntersecting, entry);
      }
    },
  });

  return <div ref={ref}>{props.children}</div>;
}
