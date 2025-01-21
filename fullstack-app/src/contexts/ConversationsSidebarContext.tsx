import {useTailwindBreakpoint} from '@/hooks/useTailwindBreakpoint';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {useIsClient} from 'usehooks-ts';

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({children}: {children: ReactNode}) {
  const isClient = useIsClient();
  const isMobile = !useTailwindBreakpoint('sm');
  const [isCollapsed, setIsCollapsed] = useState(isMobile);
  const pathname = isClient ? window.location.pathname : undefined;

  // URL changed! So we toggle the sidebar
  useEffect(() => {
    setIsCollapsed(isMobile);
  }, [pathname, isMobile]);

  return (
    <SidebarContext.Provider value={{isCollapsed, setIsCollapsed}}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);

  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }

  return context;
}
