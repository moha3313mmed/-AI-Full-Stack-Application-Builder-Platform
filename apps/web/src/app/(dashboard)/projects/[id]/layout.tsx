'use client';

import { ArrowLeft, Code2, Eye, GitBranch, Settings, Terminal } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProject } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';

const projectTabs = [
  { name: 'Code', href: '', icon: Code2 },
  { name: 'Preview', href: '/preview', icon: Eye },
  { name: 'Terminal', href: '/terminal', icon: Terminal },
  { name: 'Git', href: '/git', icon: GitBranch },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const id = params.id as string;
  const { project, isLoading } = useProject(id);

  const basePath = `/projects/${id}`;

  return (
    <div className="flex h-full flex-col">
      {/* Project Header */}
      <div className="border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/projects">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            {isLoading ? (
              <Skeleton className="h-6 w-40" />
            ) : (
              <>
                <h2 className="text-lg font-semibold">
                  {project?.name || 'Project'}
                </h2>
                {project?.status && (
                  <Badge variant="secondary">{project.status}</Badge>
                )}
              </>
            )}
          </div>
        </div>
        {/* Tabs */}
        <div className="mt-3 flex gap-1">
          {projectTabs.map((tab) => {
            const tabPath = `${basePath}${tab.href}`;
            const isActive =
              tab.href === ''
                ? pathname === basePath
                : pathname.startsWith(tabPath);
            return (
              <Link key={tab.name} href={tabPath}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'gap-2',
                    isActive && 'bg-accent text-accent-foreground'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.name}
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
