import {Button} from '@/components/shadcn-ui/button';
import {useSidebar} from '@/contexts/ConversationsSidebarContext';
import {cn} from '@/utils/ui/utils';
import {Menu} from 'lucide-react';
import {ConversationSidebarSection} from './ConversationSidebarSection';
import {HomeSidebarSection} from './HomeSidebarSection';

export function Sidebar() {
  const {isCollapsed, setIsCollapsed} = useSidebar();

  return (
    <div
      className={cn(
        'border-r transition-all duration-300',
        isCollapsed ? 'w-12' : 'w-80'
      )}
    >
      <div
        className={cn(
          'flex h-full flex-col gap-4',
          isCollapsed ? 'p-0 pt-4' : 'p-4'
        )}
      >
        <div
          className={cn(
            'flex w-full',
            isCollapsed ? 'justify-center' : 'justify-end'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 shrink-0"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        <div
          className={cn(
            'flex flex-col gap-4 overflow-hidden transition-all duration-300',
            isCollapsed ? 'opacity-0' : 'opacity-100'
          )}
        >
          <HomeSidebarSection />
          <ConversationSidebarSection />
        </div>
      </div>
    </div>
  );
}
