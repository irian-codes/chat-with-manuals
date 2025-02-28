import {usePathname} from '@/hooks/usePathname';
import {useTailwindBreakpoint} from '@/hooks/useTailwindBreakpoint';
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

// TODO #58: Remove this file when the app is finished and we haven't found any
// consumer for this context. Dead code is not a good practice.

/**
 * This context provider exposes the conversations sidebar `isCollapsed`
 * state. For now it is not consumed by any component (but it was in the
 * past). I left it here in case we need it in the future because it
 * doesn't hurt anything (for now). What I mean is you could move the state
 * into the ConversationSidebar component and remove this context if it
 * causes issues.
 *
 * Just leaving this here in case someone wonders why do we have this
 * context provider.
 */
export function SidebarProvider({children}: {children: ReactNode}) {
  const isMobile = !useTailwindBreakpoint('sm');
  const [isCollapsed, setIsCollapsed] = useState(isMobile);
  const pathname = usePathname();

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
