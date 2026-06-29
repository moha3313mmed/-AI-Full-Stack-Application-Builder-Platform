'use client';

import {
  CheckCircle2,
  Circle,
  Edit2,
  Loader2,
  Plug,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { ConfigFormDialog } from '@/components/admin/ConfigFormDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiClient } from '@/lib/api';

type ConfigCategory =
  | 'AI_PROVIDERS'
  | 'DEPLOYMENT_PROVIDERS'
  | 'SOURCE_CONTROL'
  | 'AUTH_PROVIDERS'
  | 'DATABASES'
  | 'OBJECT_STORAGE'
  | 'EMAIL_PROVIDERS'
  | 'PAYMENT_PROVIDERS'
  | 'MONITORING_ANALYTICS';

interface ConfigItem {
  id?: string;
  category: string;
  key: string;
  value?: string;
  displayName: string;
  description?: string;
  isSecret?: boolean;
  isActive?: boolean;
  lastTestedAt?: string | null;
  lastRotatedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const KNOWN_PROVIDER_FIELDS: Record<ConfigCategory, { key: string; displayName: string; description: string; isSecret: boolean }[]> = {
  AI_PROVIDERS: [
    { key: 'openai_api_key', displayName: 'OpenAI API Key', description: 'API key for OpenAI GPT models', isSecret: true },
    { key: 'anthropic_api_key', displayName: 'Anthropic API Key', description: 'API key for Claude models', isSecret: true },
    { key: 'gemini_api_key', displayName: 'Google Gemini API Key', description: 'API key for Google Gemini models', isSecret: true },
    { key: 'deepseek_api_key', displayName: 'DeepSeek API Key', description: 'API key for DeepSeek models', isSecret: true },
    { key: 'openrouter_api_key', displayName: 'OpenRouter API Key', description: 'API key for OpenRouter proxy', isSecret: true },
    { key: 'azure_openai_endpoint', displayName: 'Azure OpenAI Endpoint', description: 'Azure OpenAI service endpoint URL', isSecret: false },
    { key: 'azure_openai_key', displayName: 'Azure OpenAI Key', description: 'Azure OpenAI service API key', isSecret: true },
    { key: 'ollama_url', displayName: 'Ollama URL', description: 'URL for self-hosted Ollama instance', isSecret: false },
    { key: 'custom_ai_provider', displayName: 'Custom AI Provider', description: 'Configuration for custom AI provider', isSecret: false },
  ],
  DEPLOYMENT_PROVIDERS: [
    { key: 'vercel_token', displayName: 'Vercel Token', description: 'Vercel deployment token', isSecret: true },
    { key: 'netlify_token', displayName: 'Netlify Token', description: 'Netlify personal access token', isSecret: true },
    { key: 'cloudflare_api_token', displayName: 'Cloudflare API Token', description: 'Cloudflare API token for Pages/Workers', isSecret: true },
    { key: 'railway_token', displayName: 'Railway Token', description: 'Railway deployment token', isSecret: true },
    { key: 'render_token', displayName: 'Render Token', description: 'Render API token', isSecret: true },
    { key: 'aws_access_key_id', displayName: 'AWS Access Key ID', description: 'AWS IAM access key ID', isSecret: true },
    { key: 'aws_secret_access_key', displayName: 'AWS Secret Access Key', description: 'AWS IAM secret access key', isSecret: true },
    { key: 'gcp_credentials', displayName: 'GCP Credentials', description: 'Google Cloud service account credentials JSON', isSecret: true },
    { key: 'azure_credentials', displayName: 'Azure Credentials', description: 'Azure service principal credentials', isSecret: true },
  ],
  SOURCE_CONTROL: [
    { key: 'github_token', displayName: 'GitHub Token', description: 'GitHub personal access token', isSecret: true },
    { key: 'gitlab_token', displayName: 'GitLab Token', description: 'GitLab personal access token', isSecret: true },
    { key: 'bitbucket_token', displayName: 'Bitbucket Token', description: 'Bitbucket app password or token', isSecret: true },
  ],
  AUTH_PROVIDERS: [
    { key: 'google_oauth_client_id', displayName: 'Google OAuth Client ID', description: 'Google OAuth 2.0 client ID', isSecret: false },
    { key: 'google_oauth_client_secret', displayName: 'Google OAuth Client Secret', description: 'Google OAuth 2.0 client secret', isSecret: true },
    { key: 'github_oauth_client_id', displayName: 'GitHub OAuth Client ID', description: 'GitHub OAuth app client ID', isSecret: false },
    { key: 'github_oauth_client_secret', displayName: 'GitHub OAuth Client Secret', description: 'GitHub OAuth app client secret', isSecret: true },
    { key: 'microsoft_oauth_client_id', displayName: 'Microsoft OAuth Client ID', description: 'Microsoft OAuth app client ID', isSecret: false },
    { key: 'microsoft_oauth_client_secret', displayName: 'Microsoft OAuth Client Secret', description: 'Microsoft OAuth app client secret', isSecret: true },
    { key: 'apple_oauth_client_id', displayName: 'Apple OAuth Client ID', description: 'Apple Sign In service ID', isSecret: false },
    { key: 'apple_oauth_client_secret', displayName: 'Apple OAuth Client Secret', description: 'Apple Sign In private key', isSecret: true },
    { key: 'facebook_oauth_app_id', displayName: 'Facebook OAuth App ID', description: 'Facebook app ID', isSecret: false },
    { key: 'facebook_oauth_app_secret', displayName: 'Facebook OAuth App Secret', description: 'Facebook app secret', isSecret: true },
    { key: 'discord_oauth_client_id', displayName: 'Discord OAuth Client ID', description: 'Discord OAuth2 client ID', isSecret: false },
    { key: 'discord_oauth_client_secret', displayName: 'Discord OAuth Client Secret', description: 'Discord OAuth2 client secret', isSecret: true },
  ],
  DATABASES: [
    { key: 'postgresql_url', displayName: 'PostgreSQL URL', description: 'PostgreSQL connection string', isSecret: true },
    { key: 'mysql_url', displayName: 'MySQL URL', description: 'MySQL connection string', isSecret: true },
    { key: 'mongodb_url', displayName: 'MongoDB URL', description: 'MongoDB connection string', isSecret: true },
    { key: 'redis_url', displayName: 'Redis URL', description: 'Redis connection string', isSecret: true },
    { key: 'supabase_url', displayName: 'Supabase URL', description: 'Supabase project URL', isSecret: false },
    { key: 'supabase_anon_key', displayName: 'Supabase Anon Key', description: 'Supabase anonymous/public key', isSecret: false },
    { key: 'firebase_config', displayName: 'Firebase Config', description: 'Firebase project configuration JSON', isSecret: false },
    { key: 'convex_url', displayName: 'Convex URL', description: 'Convex deployment URL', isSecret: false },
  ],
  OBJECT_STORAGE: [
    { key: 'aws_s3_bucket', displayName: 'AWS S3 Bucket', description: 'S3 bucket name', isSecret: false },
    { key: 'aws_s3_region', displayName: 'AWS S3 Region', description: 'S3 bucket region', isSecret: false },
    { key: 'aws_s3_access_key', displayName: 'AWS S3 Access Key', description: 'S3 access key ID', isSecret: true },
    { key: 'aws_s3_secret_key', displayName: 'AWS S3 Secret Key', description: 'S3 secret access key', isSecret: true },
    { key: 'minio_endpoint', displayName: 'MinIO Endpoint', description: 'MinIO server endpoint URL', isSecret: false },
    { key: 'minio_access_key', displayName: 'MinIO Access Key', description: 'MinIO access key', isSecret: true },
    { key: 'minio_secret_key', displayName: 'MinIO Secret Key', description: 'MinIO secret key', isSecret: true },
    { key: 'cloudflare_r2_account_id', displayName: 'Cloudflare R2 Account ID', description: 'Cloudflare account ID for R2', isSecret: false },
    { key: 'cloudflare_r2_access_key', displayName: 'Cloudflare R2 Access Key', description: 'R2 access key ID', isSecret: true },
    { key: 'cloudflare_r2_secret_key', displayName: 'Cloudflare R2 Secret Key', description: 'R2 secret access key', isSecret: true },
    { key: 'backblaze_b2_key_id', displayName: 'Backblaze B2 Key ID', description: 'Backblaze B2 application key ID', isSecret: true },
    { key: 'backblaze_b2_app_key', displayName: 'Backblaze B2 App Key', description: 'Backblaze B2 application key', isSecret: true },
  ],
  EMAIL_PROVIDERS: [
    { key: 'smtp_host', displayName: 'SMTP Host', description: 'SMTP server hostname', isSecret: false },
    { key: 'smtp_port', displayName: 'SMTP Port', description: 'SMTP server port', isSecret: false },
    { key: 'smtp_user', displayName: 'SMTP User', description: 'SMTP authentication username', isSecret: false },
    { key: 'smtp_password', displayName: 'SMTP Password', description: 'SMTP authentication password', isSecret: true },
    { key: 'sendgrid_api_key', displayName: 'SendGrid API Key', description: 'SendGrid API key for email delivery', isSecret: true },
    { key: 'resend_api_key', displayName: 'Resend API Key', description: 'Resend API key for email delivery', isSecret: true },
    { key: 'mailgun_api_key', displayName: 'Mailgun API Key', description: 'Mailgun API key', isSecret: true },
    { key: 'mailgun_domain', displayName: 'Mailgun Domain', description: 'Mailgun sending domain', isSecret: false },
    { key: 'ses_access_key', displayName: 'SES Access Key', description: 'Amazon SES access key ID', isSecret: true },
    { key: 'ses_secret_key', displayName: 'SES Secret Key', description: 'Amazon SES secret access key', isSecret: true },
    { key: 'ses_region', displayName: 'SES Region', description: 'Amazon SES region', isSecret: false },
  ],
  PAYMENT_PROVIDERS: [
    { key: 'stripe_secret_key', displayName: 'Stripe Secret Key', description: 'Stripe secret API key', isSecret: true },
    { key: 'stripe_publishable_key', displayName: 'Stripe Publishable Key', description: 'Stripe publishable API key', isSecret: false },
    { key: 'stripe_webhook_secret', displayName: 'Stripe Webhook Secret', description: 'Stripe webhook signing secret', isSecret: true },
    { key: 'paypal_client_id', displayName: 'PayPal Client ID', description: 'PayPal REST API client ID', isSecret: false },
    { key: 'paypal_client_secret', displayName: 'PayPal Client Secret', description: 'PayPal REST API client secret', isSecret: true },
    { key: 'paddle_api_key', displayName: 'Paddle API Key', description: 'Paddle API key', isSecret: true },
    { key: 'paddle_webhook_secret', displayName: 'Paddle Webhook Secret', description: 'Paddle webhook verification secret', isSecret: true },
    { key: 'lemonsqueezy_api_key', displayName: 'Lemon Squeezy API Key', description: 'Lemon Squeezy API key', isSecret: true },
    { key: 'lemonsqueezy_webhook_secret', displayName: 'Lemon Squeezy Webhook Secret', description: 'Lemon Squeezy webhook secret', isSecret: true },
  ],
  MONITORING_ANALYTICS: [
    { key: 'sentry_dsn', displayName: 'Sentry DSN', description: 'Sentry Data Source Name for error tracking', isSecret: false },
    { key: 'posthog_api_key', displayName: 'PostHog API Key', description: 'PostHog project API key', isSecret: true },
    { key: 'posthog_host', displayName: 'PostHog Host', description: 'PostHog instance URL', isSecret: false },
    { key: 'google_analytics_id', displayName: 'Google Analytics ID', description: 'Google Analytics measurement ID', isSecret: false },
    { key: 'prometheus_endpoint', displayName: 'Prometheus Endpoint', description: 'Prometheus pushgateway endpoint', isSecret: false },
    { key: 'grafana_url', displayName: 'Grafana URL', description: 'Grafana dashboard URL', isSecret: false },
    { key: 'grafana_api_key', displayName: 'Grafana API Key', description: 'Grafana service account API key', isSecret: true },
  ],
};

interface ConfigurationPanelProps {
  category: ConfigCategory;
  categoryLabel: string;
}

export function ConfigurationPanel({ category, categoryLabel }: ConfigurationPanelProps) {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<ConfigItem[]>(`/admin/platform-config/${category}`);
      setConfigs(data);
    } catch {
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleTestConnection = async (key: string) => {
    setTestingKey(key);
    try {
      await apiClient.post('/admin/platform-config/test-connection', {
        category,
        key,
      });
      await fetchConfigs();
    } catch {
      // Error handled silently - the UI will show last tested status
    } finally {
      setTestingKey(null);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await apiClient.delete(`/admin/platform-config/${category}/${key}`);
      await fetchConfigs();
    } catch {
      // Error handled silently
    }
  };

  const handleEdit = (config: ConfigItem) => {
    setEditingConfig(config);
    setDialogOpen(true);
  };

  const handleCreate = (knownField: { key: string; displayName: string; description: string; isSecret: boolean }) => {
    setEditingConfig({
      category,
      key: knownField.key,
      displayName: knownField.displayName,
      description: knownField.description,
      isSecret: knownField.isSecret,
    });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingConfig(null);
  };

  const handleSaveSuccess = () => {
    handleDialogClose();
    fetchConfigs();
  };

  // Merge known fields with actual config data
  const knownFields = KNOWN_PROVIDER_FIELDS[category] || [];
  const mergedItems = knownFields.map((field) => {
    const existing = configs.find((c) => c.key === field.key);
    return existing
      ? { ...field, ...existing, configured: true }
      : { ...field, category, configured: false };
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{categoryLabel}</CardTitle>
          <CardDescription>
            Manage credentials and configuration for {categoryLabel.toLowerCase()} integrations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mergedItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  {item.configured ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.displayName}</span>
                      {item.configured ? (
                        <Badge variant="default" className="text-[10px]">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Not configured</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                    {item.configured && (
                      <div className="mt-1 flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          {'••••••••••••'}
                        </span>
                        {item.lastTestedAt && (
                          <span className="text-[10px] text-muted-foreground">
                            Last tested: {new Date(item.lastTestedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.configured && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestConnection(item.key)}
                        disabled={testingKey === item.key}
                      >
                        {testingKey === item.key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plug className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      item.configured
                        ? handleEdit(item as ConfigItem)
                        : handleCreate(item)
                    }
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ConfigFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        config={editingConfig}
        category={category}
        onSuccess={handleSaveSuccess}
        onCancel={handleDialogClose}
        defaultIsSecret={editingConfig?.isSecret ?? true}
      />
    </>
  );
}
