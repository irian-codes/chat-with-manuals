import {Button} from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/router';

export default function LocaleSwitcher() {
  const t = useTranslations('locale-switcher');
  const {locale, locales, route} = useRouter();

  const flags = {
    en: '🇬🇧',
    es: '🇪🇸',
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <span className="text-lg">{flags[locale as keyof typeof flags]}</span>
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
                <span className="text-lg">
                  {flags[locale as keyof typeof flags]}
                </span>
                <span>{t('locale', {locale})}</span>
              </Link>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
