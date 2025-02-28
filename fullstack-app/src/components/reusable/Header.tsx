import {UserButton} from '@clerk/nextjs';
import {type ReactNode} from 'react';
import {LanguageSwitcher} from './LanguageSwitcher';

interface HeaderProps {
  children?: ReactNode;
}

export function Header({children}: HeaderProps) {
  return (
    <header className="border-b">
      <div className="flex flex-nowrap items-center justify-between gap-4 overflow-hidden p-4">
        {children}
        <div className="flex flex-col gap-2 pr-4 sm:flex-row-reverse">
          <LanguageSwitcher />
          <UserButton />
        </div>
      </div>
    </header>
  );
}
