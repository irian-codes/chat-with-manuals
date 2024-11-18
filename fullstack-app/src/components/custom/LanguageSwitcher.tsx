import {Button} from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {cn} from '@/lib/utils';
import 'flag-icons/css/flag-icons.min.css';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/router';

export default function LocaleSwitcher() {
  const t = useTranslations('locale-switcher');
  const {locale, locales, route} = useRouter();

  const flagClasses = {
    // https://github.com/lipis/flag-icons
    en: 'fi fi-gb',
    es: 'fi fi-es',
  };

  return (
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
                href={route}
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
  );
}
