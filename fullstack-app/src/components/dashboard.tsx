import {Button} from '@/components/ui/button';
import {Card, CardContent} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {ScrollArea} from '@/components/ui/scroll-area';
import type {Conversation} from '@/types/Conversation';
import type {Document} from '@/types/Document';
import {UserButton} from '@clerk/nextjs';
import {ExternalLink, Plus, Search, Upload, X} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Image from 'next/image';

interface DashboardProps {
  conversations: Conversation[];
  documents: Document[];
}

export function Dashboard({conversations, documents}: DashboardProps) {
  const tSidebar = useTranslations('conversation-sidebar');
  const tDocumentManager = useTranslations('document-manager');
  const format = useFormatter();

  return (
    <div className="flex h-screen w-full flex-row bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r">
        <div className="space-y-4 p-4">
          <h2 className="text-xl font-semibold">{tSidebar('title')}</h2>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder={tSidebar('search')} className="pl-8" />
          </div>
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <Button
                  key={conversation.id}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <span className="truncate font-normal">
                    {conversation.title}
                  </span>
                </Button>
              ))}
              <Button className="w-full">
                <Plus className="mr-1 h-4 w-4" />
                {tSidebar('newConversation')}
              </Button>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <header className="border-b">
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tDocumentManager('header.search')}
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-4">
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                {tDocumentManager('header.upload')}
              </Button>
              <UserButton />
            </div>
          </div>
        </header>

        <main className="p-4">
          <div className="flex flex-row flex-wrap gap-4">
            {[
              {
                id: '1',
                title: tDocumentManager('uploading-document'),
                date: format.relativeTime(
                  new Date(Date.now() - 3 * 60 * 1000),
                  Date.now()
                ),
              },
              ...documents,
            ].map((doc) => (
              <Card key={doc.id} className="max-w-[14rem]">
                <CardContent className="p-0">
                  <Image
                    src="https://picsum.photos/400"
                    alt={tDocumentManager('image-alt')}
                    className="aspect-[1/1] rounded-t-xl object-cover"
                    width={400}
                    height={400}
                    placeholder="blur"
                    blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mO8Ww8AAj8BXkQ+xPEAAAAASUVORK5CYII="
                    loading="lazy"
                    decoding="async"
                    fetchPriority="auto"
                    referrerPolicy="no-referrer"
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="line-clamp-2 font-medium">
                          {doc.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {doc.date}
                        </p>
                      </div>
                      {doc.title === 'Uploading...' ? (
                        <Button variant="ghost" size="icon">
                          <X className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
