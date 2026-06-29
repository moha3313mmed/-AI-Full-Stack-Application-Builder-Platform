'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SecurityScanType } from '@/hooks/useSecurityScans';

interface ScanTriggerProps {
  onTrigger: (scanTypes: SecurityScanType[]) => void;
  isScanning?: boolean;
}

const scanTypes: { value: SecurityScanType; label: string }[] = [
  { value: 'VULNERABILITY', label: 'Vulnerability' },
  { value: 'SECRET_DETECTION', label: 'Secrets' },
  { value: 'SQL_INJECTION', label: 'SQL Injection' },
  { value: 'XSS', label: 'XSS' },
  { value: 'CSRF', label: 'CSRF' },
  { value: 'AUTH_REVIEW', label: 'Auth Review' },
  { value: 'OWASP_FULL', label: 'Full OWASP' },
];

export function ScanTrigger({ onTrigger, isScanning }: ScanTriggerProps) {
  const [selected, setSelected] = useState<SecurityScanType[]>([]);

  const toggleType = (type: SecurityScanType) => {
    setSelected((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  const handleTrigger = () => {
    if (selected.length > 0) {
      onTrigger(selected);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Run Security Scan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {scanTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => toggleType(type.value)}
              className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                selected.includes(type.value)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input text-muted-foreground hover:bg-accent'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
        <Button
          onClick={handleTrigger}
          disabled={selected.length === 0 || isScanning}
          className="w-full gap-2"
        >
          <Play className="h-4 w-4" />
          {isScanning ? 'Scanning...' : 'Run Scan'}
        </Button>
      </CardContent>
    </Card>
  );
}
