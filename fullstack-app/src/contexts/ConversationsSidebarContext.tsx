import {useTailwindBreakpoint} from '@/hooks/useTailwindBreakpoint';
import {useRouter} from 'next/router';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({children}: {children: ReactNode}) {
  const isNotMobile = useTailwindBreakpoint('sm');
  const [isCollapsed, setIsCollapsed] = useState(!isNotMobile);
  const router = useRouter();

  // Track previous pathname to detect real route changes
  const [prevPathname, setPrevPathname] = useState(router.pathname);
  if (router.pathname !== prevPathname) {
    setPrevPathname(router.pathname);
    setIsCollapsed(!isNotMobile);
  }

  // Needed because useTailwindBreakpoint hook runs on the server and
  // always returns false. So when we actually hydrate the app, we need to
  // set the state again
  useEffect(() => {
    setIsCollapsed(!isNotMobile);
  }, [isNotMobile]);

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
