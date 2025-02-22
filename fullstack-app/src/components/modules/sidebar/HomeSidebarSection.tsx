import {ToggleableLink} from '@/components/reusable/ToggleableLink';
import {usePathname} from '@/hooks/usePathname';
import {cn} from '@/utils/ui/utils';
import {Files} from 'lucide-react';
import {useTranslations} from 'next-intl';

export const HomeSidebarSection = () => {
  const pathname = usePathname();
  const t = useTranslations('sidebar.home');

  return (
    <ToggleableLink linkProps={{href: '/'}} disabled={pathname === '/'}>
      <div className="flex flex-row items-center justify-start gap-2">
        <Files size={22} />
        <h2
          className={cn(
            'text-xl font-semibold',
            /^\/(?:[a-z]{2})?$/.test(pathname) ? 'italic' : undefined
          )}
        >
          {t('title')}
        </h2>
      </div>
    </ToggleableLink>
  );
};
