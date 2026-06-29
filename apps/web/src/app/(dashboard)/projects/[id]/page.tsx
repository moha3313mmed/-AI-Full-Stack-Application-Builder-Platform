'use client';

import { Plus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';

import { AgentActivityPanel } from '@/components/agents/AgentActivityPanel';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { TeamPanel } from '@/components/collaboration/TeamPanel';
import { DeploymentPanel } from '@/components/deploy/DeploymentPanel';
import { CodeViewer } from '@/components/editor/CodeViewer';
import { CreateFileDialog } from '@/components/editor/CreateFileDialog';
import { EditorTabs } from '@/components/editor/EditorTabs';
import { FileExplorer, type FileNode } from '@/components/editor/FileExplorer';
import { GitPanel } from '@/components/git/GitPanel';
import { MemoryPanel } from '@/components/memory/MemoryPanel';
import { LivePreview } from '@/components/preview/LivePreview';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFileChanges } from '@/hooks/useFileChanges';
import { useFileContent } from '@/hooks/useFileContent';
import { useFileOperations } from '@/hooks/useFileOperations';
import { useProjectFiles } from '@/hooks/useProjectFiles';

// Fallback file tree for demonstration when API is unavailable
const fallbackFiles: FileNode[] = [
  {
    name: 'src',
    path: '/src',
    type: 'directory',
    children: [
      {
        name: 'app',
        path: '/src/app',
        type: 'directory',
        children: [
          { name: 'page.tsx', path: '/src/app/page.tsx', type: 'file' },
          { name: 'layout.tsx', path: '/src/app/layout.tsx', type: 'file' },
          { name: 'globals.css', path: '/src/app/globals.css', type: 'file' },
        ],
      },
      {
        name: 'components',
        path: '/src/components',
        type: 'directory',
        children: [
          { name: 'Header.tsx', path: '/src/components/Header.tsx', type: 'file' },
          { name: 'Footer.tsx', path: '/src/components/Footer.tsx', type: 'file' },
        ],
      },
      { name: 'lib', path: '/src/lib', type: 'directory', children: [] },
    ],
  },
  { name: 'package.json', path: '/package.json', type: 'file' },
  { name: 'tsconfig.json', path: '/tsconfig.json', type: 'file' },
  { name: 'README.md', path: '/README.md', type: 'file' },
];

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = params.id as string;

  const { files, isLoading: filesLoading } = useProjectFiles(projectId);
  const { createFile, updateFile } = useFileOperations(projectId);
  useFileChanges(projectId);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<{ path: string; name: string; isModified?: boolean }[]>(
    []
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bottomPanel, setBottomPanel] = useState<'chat' | 'preview' | 'memory' | 'agents' | 'deploy' | 'git' | 'team'>('chat');

  const { content, language, isLoading: contentLoading } = useFileContent(
    projectId,
    selectedFile
  );

  const displayFiles = files.length > 0 ? files : fallbackFiles;

  const handleFileSelect = useCallback(
    (path: string) => {
      setSelectedFile(path);
      setOpenTabs((prev) => {
        if (prev.find((t) => t.path === path)) return prev;
        const name = path.split('/').pop() || path;
        return [...prev, { path, name }];
      });
    },
    []
  );

  const handleTabClose = useCallback(
    (path: string) => {
      setOpenTabs((prev) => {
        const newTabs = prev.filter((t) => t.path !== path);
        if (selectedFile === path) {
          setSelectedFile(
            newTabs.length > 0 ? newTabs[newTabs.length - 1].path : null
          );
        }
        return newTabs;
      });
    },
    [selectedFile]
  );

  const handleSave = useCallback(
    (fileContent: string) => {
      if (!selectedFile) return;
      updateFile({ path: selectedFile, content: fileContent });
    },
    [selectedFile, updateFile]
  );

  const handleCreateFile = useCallback(
    (data: { path: string; type: 'file' | 'directory' }) => {
      createFile({ path: data.path, type: data.type });
    },
    [createFile]
  );

  return (
    <div className="flex h-full">
      {/* File Explorer */}
      <div className="w-60 shrink-0">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-end border-b px-2 py-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCreateDialogOpen(true)}
              title="New file"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <FileExplorer
              files={displayFiles}
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile || undefined}
            />
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Editor Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <EditorTabs
            tabs={openTabs}
            activeTab={selectedFile || undefined}
            onTabSelect={setSelectedFile}
            onTabClose={handleTabClose}
          />
          <div className="flex-1 overflow-hidden">
            {selectedFile ? (
              contentLoading ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <span className="text-sm">Loading file...</span>
                </div>
              ) : (
                <CodeViewer
                  code={content}
                  filename={selectedFile}
                  language={language}
                  editable
                  onSave={handleSave}
                />
              )
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {filesLoading
                  ? 'Loading project files...'
                  : 'Select a file to view'}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Panel with Tabs */}
        <div className="h-64 shrink-0 border-t">
          <Tabs
            value={bottomPanel}
            onValueChange={(v) => setBottomPanel(v as typeof bottomPanel)}
            className="flex h-full flex-col"
          >
            <TabsList className="h-9 w-full justify-start rounded-none border-b bg-transparent px-2">
              <TabsTrigger value="chat" className="text-xs">
                Chat
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">
                Preview
              </TabsTrigger>
              <TabsTrigger value="memory" className="text-xs">
                Memory
              </TabsTrigger>
              <TabsTrigger value="agents" className="text-xs">
                Agents
              </TabsTrigger>
              <TabsTrigger value="deploy" className="text-xs">
                Deploy
              </TabsTrigger>
              <TabsTrigger value="git" className="text-xs">
                Git
              </TabsTrigger>
              <TabsTrigger value="team" className="text-xs">
                Team
              </TabsTrigger>
            </TabsList>
            <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
              <ChatPanel projectId={projectId} />
            </TabsContent>
            <TabsContent value="preview" className="flex-1 overflow-hidden mt-0">
              <LivePreview projectId={projectId} />
            </TabsContent>
            <TabsContent value="memory" className="flex-1 overflow-hidden mt-0">
              <MemoryPanel projectId={projectId} />
            </TabsContent>
            <TabsContent value="agents" className="flex-1 overflow-hidden mt-0">
              <AgentActivityPanel projectId={projectId} />
            </TabsContent>
            <TabsContent value="deploy" className="flex-1 overflow-hidden mt-0">
              <DeploymentPanel projectId={projectId} />
            </TabsContent>
            <TabsContent value="git" className="flex-1 overflow-hidden mt-0">
              <GitPanel projectId={projectId} />
            </TabsContent>
            <TabsContent value="team" className="flex-1 overflow-hidden mt-0">
              <TeamPanel projectId={projectId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <CreateFileDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateFile}
      />
    </div>
  );
}
