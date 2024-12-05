import {useSidebar} from '@/contexts/ConversationsSidebarContext';
import {useTailwindBreakpoint} from '@/hooks/useTailwindBreakpoint';
import {type ReactNode} from 'react';
import {LanguageSwitcher} from './LanguageSwitcher';

interface HeaderProps {
  children?: ReactNode;
}

export function Header({children}: HeaderProps) {
  const {isCollapsed} = useSidebar();
  const isNotMobile = useTailwindBreakpoint('sm');
  const showLanguageSwitcher = isCollapsed || isNotMobile;

  return (
    <header className="border-b">
      <div className="relative w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 pr-16">
          {children}
        </div>
        {showLanguageSwitcher && (
          <div className="absolute right-6 top-4 sm:right-4">
            <LanguageSwitcher />
          </div>
        )}
      </div>
    </header>
  );
}
