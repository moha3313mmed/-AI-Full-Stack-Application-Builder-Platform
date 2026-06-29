'use client';

import { Cloud, Globe, Server, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

const PROVIDERS = [
  { id: 'vercel', name: 'Vercel', icon: Zap, description: 'Serverless deployment' },
  { id: 'netlify', name: 'Netlify', icon: Globe, description: 'JAMstack hosting' },
  { id: 'aws', name: 'AWS', icon: Cloud, description: 'AWS infrastructure' },
  { id: 'docker', name: 'Docker', icon: Server, description: 'Container deployment' },
] as const;

interface ProviderSelectorProps {
  value?: string;
  onChange: (providerId: string) => void;
}

export function ProviderSelector({ value, onChange }: ProviderSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PROVIDERS.map((provider) => {
        const Icon = provider.icon;
        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => onChange(provider.id)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md border p-3 text-center transition-colors hover:bg-accent',
              value === provider.id && 'border-primary bg-accent'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs font-medium">{provider.name}</span>
            <span className="text-[10px] text-muted-foreground">{provider.description}</span>
          </button>
        );
      })}
    </div>
  );
}
