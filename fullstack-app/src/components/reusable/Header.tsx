import {type ReactNode} from 'react';
import {LanguageSwitcher} from './LanguageSwitcher';

interface HeaderProps {
  children?: ReactNode;
}

export function Header({children}: HeaderProps) {
  return (
    <header className="border-b pr-12">
      <div className="flex w-full flex-wrap items-center justify-between gap-4 p-4 pr-4">
        {children}
      </div>
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
    </header>
  );
}
