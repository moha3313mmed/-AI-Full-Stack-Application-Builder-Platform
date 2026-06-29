'use client';

import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { TechStackSelector, type TechOption } from '@/components/project/TechStackSelector';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const frameworkOptions: TechOption[] = [
  { id: 'nextjs', name: 'Next.js', description: 'Full-stack React framework' },
  { id: 'react', name: 'React', description: 'UI component library' },
  { id: 'vue', name: 'Vue.js', description: 'Progressive JavaScript framework' },
  { id: 'svelte', name: 'Svelte', description: 'Compiler-based framework' },
  { id: 'express', name: 'Express', description: 'Node.js web framework' },
  { id: 'nestjs', name: 'NestJS', description: 'Enterprise Node.js framework' },
];

const languageOptions: TechOption[] = [
  { id: 'typescript', name: 'TypeScript', description: 'Typed JavaScript' },
  { id: 'javascript', name: 'JavaScript', description: 'Dynamic scripting language' },
  { id: 'python', name: 'Python', description: 'General-purpose language' },
];

const databaseOptions: TechOption[] = [
  { id: 'postgresql', name: 'PostgreSQL', description: 'Advanced relational DB' },
  { id: 'mysql', name: 'MySQL', description: 'Popular relational DB' },
  { id: 'mongodb', name: 'MongoDB', description: 'Document database' },
  { id: 'sqlite', name: 'SQLite', description: 'Embedded database' },
];

const aiModelOptions: TechOption[] = [
  { id: 'gpt4', name: 'GPT-4', description: 'OpenAI advanced model' },
  { id: 'claude', name: 'Claude', description: 'Anthropic AI assistant' },
  { id: 'gemini', name: 'Gemini', description: 'Google AI model' },
  { id: 'llama', name: 'Llama', description: 'Meta open-source model' },
];

const STEPS = ['Details', 'Tech Stack', 'AI Preferences', 'Review'];

export default function NewProjectPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    framework: null as string | null,
    language: null as string | null,
    database: null as string | null,
    aiModel: null as string | null,
  });
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 0:
        return formData.name.trim().length > 0;
      case 1:
        return !!formData.framework && !!formData.language;
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreate = async () => {
    setError('');
    setIsCreating(true);
    try {
      // API call would go here
      router.push('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
        <p className="text-muted-foreground">
          Set up your project in a few simple steps.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, idx) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                idx < currentStep
                  ? 'bg-primary text-primary-foreground'
                  : idx === currentStep
                    ? 'border-2 border-primary text-primary'
                    : 'border border-muted-foreground/30 text-muted-foreground'
              }`}
            >
              {idx < currentStep ? <Check className="h-4 w-4" /> : idx + 1}
            </div>
            <span
              className={`text-sm ${
                idx <= currentStep ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {step}
            </span>
            {idx < STEPS.length - 1 && (
              <div className="mx-2 h-px w-8 bg-border" />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="My Awesome Project"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <textarea
                  id="description"
                  placeholder="A brief description of your project..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <TechStackSelector
                title="Framework"
                options={frameworkOptions}
                selected={formData.framework}
                onSelect={(id) => setFormData({ ...formData, framework: id })}
              />
              <TechStackSelector
                title="Language"
                options={languageOptions}
                selected={formData.language}
                onSelect={(id) => setFormData({ ...formData, language: id })}
              />
              <TechStackSelector
                title="Database"
                options={databaseOptions}
                selected={formData.database}
                onSelect={(id) => setFormData({ ...formData, database: id })}
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <TechStackSelector
                title="Preferred AI Model"
                options={aiModelOptions}
                selected={formData.aiModel}
                onSelect={(id) => setFormData({ ...formData, aiModel: id })}
              />
              <p className="text-sm text-muted-foreground">
                You can change your AI model preferences later in project settings.
              </p>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="text-lg">Review your project</CardTitle>
                <CardDescription>
                  Confirm the details before creating your project.
                </CardDescription>
              </CardHeader>
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="text-sm font-medium">{formData.name}</span>
                </div>
                {formData.description && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Description</span>
                    <span className="text-sm font-medium max-w-[60%] text-right">
                      {formData.description}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Framework</span>
                  <span className="text-sm font-medium">
                    {frameworkOptions.find((f) => f.id === formData.framework)?.name || 'Not selected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Language</span>
                  <span className="text-sm font-medium">
                    {languageOptions.find((l) => l.id === formData.language)?.name || 'Not selected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Database</span>
                  <span className="text-sm font-medium">
                    {databaseOptions.find((d) => d.id === formData.database)?.name || 'Not selected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">AI Model</span>
                  <span className="text-sm font-medium">
                    {aiModelOptions.find((m) => m.id === formData.aiModel)?.name || 'Not selected'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {currentStep < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canGoNext()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Project'}
          </Button>
        )}
      </div>
    </div>
  );
}
