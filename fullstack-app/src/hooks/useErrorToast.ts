import {env} from '@/env';
import {useToast} from '@/hooks/useToast';
import {nonEmptyStringSchema} from '@/utils/strings';
import {type TRPCError} from '@trpc/server';
import {useTranslations} from 'next-intl';
import {z} from 'zod';

const errorSchema = z.object({
  data: z.object({
    code: nonEmptyStringSchema,
  }),
});

export type ToastErrorType = {
  data: {
    code: TRPCError['code'] | 'UNKNOWN_ERROR';
  };
};

/**
 * A custom hook for displaying error toasts with localized messages
 * automatically obtained from the error code.
 *
 * @param {string} i18nKeyRootPath - The root path for error message
 * translations in the i18n system. Pass as the hook's parameter the i18n
 * route for an object that has the shape of `{"api": {... keys}}` with an
 * optional `unknown-error` key outside, like:
 * ```
 * {
 *   "api": {
 *     "bad-request": "...",
 *     "internal-server-error": "...",
 *     "rest of desired keys as HTTP error codes in kebab case"
 *   },
 *   "unknown-error": "..."
 * }
 * ```
 *
 * If you don't want to pass a scoped i18n set of messages, just pass the
 * app generic ones as `useErrorToast('app.errors')`.
 *
 * @returns {Function} A function that takes an error object and displays a
 * toast with the appropriate localized error message.
 *
 * @example
 * const invokeErrorToast = useErrorToast('conversation.errors');
 * // ... where you want to display the error toast in the code.
 * invokeErrorToast(error);
 *
 * @description
 * This hook handles error toasts by:
 * 1. Accepting a root path for error message translations
 * 2. Parsing the error object to determine the error type
 * 3. Looking up the appropriate localized error message based on the error
 *    code
 * 4. Displaying a toast with the error message
 *
 * The hook will attempt to find the error message in the following order:
 * 1. In the scoped error translations (using i18nKeyRootPath)
 * 2. In the global app error translations
 * 3. Fallback to a generic 'unknown-error' message
 */
export function useErrorToast(
  i18nKeyRootPath: Parameters<typeof useTranslations>[0]
): (error: unknown) => void {
  const {toast} = useToast();
  const tAllErrors = useTranslations('app.errors');
  const tScopedErrors = useTranslations(i18nKeyRootPath);

  if (env.NEXT_PUBLIC_CLIENT_ENV === 'development') {
    nonEmptyStringSchema
      .refine((path) => path.includes('.errors'), {
        message: `i18nKeyRootPath must include '.errors' in the path. Check other files to see how to use this hook.`,
      })
      .refine((path) => !path.includes('.api'), {
        message: `i18nKeyRootPath must not include '.api' in the path as the code needs the parent key to correctly parse the error. Check other files to see how to use this hook.`,
      })
      .parse(i18nKeyRootPath);
  }

  function summonToast(message: string) {
    toast({
      variant: 'destructive',
      title: message,
    });
  }

  function getCorrectLocalizedMessage(key: Parameters<typeof tAllErrors>[0]) {
    const unknownErrorKey = 'unknown-error';

    if (tScopedErrors.has(key)) {
      return tScopedErrors(key);
    }

    if (tAllErrors.has(key)) {
      return tAllErrors(key);
    }

    if (tScopedErrors.has(unknownErrorKey)) {
      return tScopedErrors(unknownErrorKey);
    }

    return tAllErrors(unknownErrorKey);
  }

  return (error: unknown) => {
    let localizedMessage = getCorrectLocalizedMessage('unknown-error');

    const _error = errorSchema.safeParse(error).data;

    if (_error == null) {
      summonToast(localizedMessage);
      return;
    }

    const normalizedCode = _error.data.code.toLowerCase().replaceAll(/_/g, '-');
    const newKey = `api.${normalizedCode}` as Exclude<
      Parameters<typeof getCorrectLocalizedMessage>[0],
      'unknown-error'
    >;

    localizedMessage = getCorrectLocalizedMessage(newKey);
    summonToast(localizedMessage);
  };
}
