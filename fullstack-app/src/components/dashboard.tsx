import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar';
import {Button} from '@/components/ui/button';
import {Card, CardContent} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {ScrollArea} from '@/components/ui/scroll-area';
import {ExternalLink, Plus, Search, Upload, X} from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
}

interface Document {
  id: string;
  title: string;
  date: string;
  thumbnail?: string;
}

// Mock data - replace with actual data fetching
const conversations: Conversation[] = [
  {id: '1', title: 'How does Bitcoin work and what are its implications?'},
  {id: '2', title: 'Troubleshooting volume issues in audio systems.'},
  {id: '3', title: 'Moving with a pawn in chess: strategies and tips.'},
  {id: '4', title: 'Configuring a detector for optimal performance.'},
];

const documents: Document[] = [
  {id: '1', title: 'Uploading...', date: '3 minutes ago'},
  {id: '2', title: 'Business report', date: '2024-10-12'},
  {id: '3', title: 'Bitcoin whitepaper', date: '2023-03-07'},
  {id: '4', title: 'Savage Worlds RPG', date: '2022-11-23'},
  {id: '5', title: 'Urban mobility report', date: '2022-10-05'},
  {
    id: '6',
    title: 'Fridge manual model X459 fasd sdad fasd  asdf asdf sa d',
    date: '2021-03-10',
  },
];

export function Dashboard() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r">
        <div className="space-y-4 p-4">
          <h2 className="text-xl font-semibold">Conversations</h2>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search conversation" className="pl-8" />
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
                New conversation
              </Button>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <header className="border-b">
          <div className="flex items-center justify-between p-4">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search file" className="pl-8" />
            </div>
            <div className="flex items-center gap-4">
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload new file
              </Button>
              <Avatar>
                <AvatarImage src="/placeholder.svg" />
                <AvatarFallback>UN</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <main className="p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="p-0">
                  <div className="aspect-[3/4] bg-muted" />
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
