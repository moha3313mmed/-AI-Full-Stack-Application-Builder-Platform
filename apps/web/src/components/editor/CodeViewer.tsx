'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { EditorStatusBar } from './EditorStatusBar';

interface CodeViewerProps {
  code: string;
  filename?: string;
  language?: string;
  editable?: boolean;
  onSave?: (content: string) => void;
}

export function CodeViewer({
  code,
  filename,
  language = 'plaintext',
  editable = false,
  onSave,
}: CodeViewerProps) {
  const [editedCode, setEditedCode] = useState(code);
  const [isModified, setIsModified] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>(
    'saved'
  );
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditedCode(code);
    setIsModified(false);
    setSaveStatus('saved');
  }, [code]);

  const handleSave = useCallback(async () => {
    if (!onSave || !isModified) return;
    setSaveStatus('saving');
    try {
      onSave(editedCode);
      setIsModified(false);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    }
  }, [editedCode, isModified, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const value = textarea.value;
          const newValue = value.substring(0, start) + '  ' + value.substring(end);
          setEditedCode(newValue);
          setIsModified(true);
          setSaveStatus('unsaved');
          requestAnimationFrame(() => {
            textarea.selectionStart = start + 2;
            textarea.selectionEnd = start + 2;
          });
        }
      }
    },
    [handleSave]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditedCode(e.target.value);
      setIsModified(true);
      setSaveStatus('unsaved');
    },
    []
  );

  const handleCursorChange = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const value = textarea.value;
    const pos = textarea.selectionStart;
    const lines = value.substring(0, pos).split('\n');
    setCursorLine(lines.length);
    setCursorColumn((lines[lines.length - 1]?.length ?? 0) + 1);
  }, []);

  const lines = (editable ? editedCode : code).split('\n');

  if (editable) {
    return (
      <div className="flex h-full flex-col">
        {filename && (
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <span className="text-xs text-muted-foreground">{filename}</span>
            {isModified && (
              <span className="h-2 w-2 rounded-full bg-yellow-500" title="Unsaved changes" />
            )}
          </div>
        )}
        <div className="relative flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="flex min-h-full">
              <div className="select-none border-r bg-muted/30 px-3 py-4 text-right font-mono text-xs text-muted-foreground">
                {lines.map((_, idx) => (
                  <div key={idx} className="leading-6">
                    {idx + 1}
                  </div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={editedCode}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onKeyUp={handleCursorChange}
                onClick={handleCursorChange}
                className={cn(
                  'flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-6 outline-none',
                  'min-h-full whitespace-pre overflow-x-auto'
                )}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
              />
            </div>
          </ScrollArea>
        </div>
        <EditorStatusBar
          language={language}
          line={cursorLine}
          column={cursorColumn}
          saveStatus={saveStatus}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {filename && (
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <span className="text-xs text-muted-foreground">{filename}</span>
          {language && (
            <span className="text-xs text-muted-foreground">({language})</span>
          )}
        </div>
      )}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <pre className="font-mono text-sm">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-accent/50">
                    <td className="w-12 select-none pr-4 text-right text-xs text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="whitespace-pre-wrap break-all">{line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </pre>
        </div>
      </ScrollArea>
      <EditorStatusBar language={language} />
    </div>
  );
}
