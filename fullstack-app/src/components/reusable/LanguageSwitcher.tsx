import {Button} from '@/components/shadcn-ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn-ui/dropdown-menu';
import {cn} from '@/utils/ui/utils';
import 'flag-icons/css/flag-icons.min.css';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/router';

export function LanguageSwitcher({className}: {className?: string}) {
  const t = useTranslations('locale-switcher');
  const {locale, locales, asPath} = useRouter();

  const flagClasses = {
    // https://github.com/lipis/flag-icons
    en: 'fi fi-gb',
    es: 'fi fi-es',
  };

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <span
              className={cn(
                'text-lg',
                flagClasses[locale as keyof typeof flagClasses]
              )}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {locales
            ?.filter((l) => l !== locale)
            .map((locale) => (
              <DropdownMenuItem key={locale} asChild>
                <Link
                  href={asPath}
                  hrefLang={locale}
                  locale={locale}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <span
                    className={cn(
                      'text-lg',
                      flagClasses[locale as keyof typeof flagClasses]
                    )}
                  />

                  <span>{t('locale', {locale})}</span>
                </Link>
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
