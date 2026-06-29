'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MarketplaceCategory } from '@/hooks/useMarketplace';

interface PublishFormProps {
  onSubmit: (data: PublishFormData) => void;
}

export interface PublishFormData {
  title: string;
  description: string;
  shortDescription: string;
  category: MarketplaceCategory;
  tags: string[];
  manifest: string;
}

const categories: { value: MarketplaceCategory; label: string }[] = [
  { value: 'AI', label: 'AI' },
  { value: 'INTEGRATION', label: 'Integration' },
  { value: 'THEME', label: 'Theme' },
  { value: 'TOOLING', label: 'Tooling' },
  { value: 'LANGUAGE', label: 'Language' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'DEPLOYMENT', label: 'Deployment' },
  { value: 'OTHER', label: 'Other' },
];

export function PublishForm({ onSubmit }: PublishFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory>('OTHER');
  const [tagsInput, setTagsInput] = useState('');
  const [manifest, setManifest] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSubmit({ title, description, shortDescription, category, tags, manifest });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publish Plugin</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Plugin"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Short Description</Label>
            <Input
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="A brief description of your plugin"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Full description of what your plugin does..."
              required
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MarketplaceCategory)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Tags (comma-separated)</Label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Plugin Manifest (JSON)</Label>
            <textarea
              value={manifest}
              onChange={(e) => setManifest(e.target.value)}
              placeholder='{"name": "my-plugin", "version": "1.0.0", ...}'
              required
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <Button type="submit" className="w-full">
            Publish
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
