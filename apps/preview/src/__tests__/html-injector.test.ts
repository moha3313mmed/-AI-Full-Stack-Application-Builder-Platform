import { describe, it, expect } from 'vitest';

import { injectHotReload, isHtmlContent, HOT_RELOAD_SCRIPT } from '../html-injector';

describe('html-injector', () => {
  describe('injectHotReload', () => {
    it('should inject script before </body> tag', () => {
      const html = '<html><body><h1>Hello</h1></body></html>';
      const result = injectHotReload(html);

      expect(result).toContain(HOT_RELOAD_SCRIPT);
      expect(result.indexOf(HOT_RELOAD_SCRIPT)).toBeLessThan(result.indexOf('</body>'));
      expect(result).toContain('<h1>Hello</h1>');
    });

    it('should inject script before </html> when no </body> tag', () => {
      const html = '<html><h1>Hello</h1></html>';
      const result = injectHotReload(html);

      expect(result).toContain(HOT_RELOAD_SCRIPT);
      expect(result.indexOf(HOT_RELOAD_SCRIPT)).toBeLessThan(result.indexOf('</html>'));
    });

    it('should append script when no closing tags found', () => {
      const html = '<h1>Hello World</h1>';
      const result = injectHotReload(html);

      expect(result).toBe(html + HOT_RELOAD_SCRIPT);
    });

    it('should handle empty string', () => {
      const result = injectHotReload('');
      expect(result).toBe(HOT_RELOAD_SCRIPT);
    });

    it('should include WebSocket connection code in injected script', () => {
      const html = '<html><body></body></html>';
      const result = injectHotReload(html);

      expect(result).toContain('new WebSocket');
      expect(result).toContain('/ws');
      expect(result).toContain('location.reload()');
      expect(result).toContain('data-preview-hot-reload');
    });

    it('should handle complex HTML with multiple body-like content', () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <div>Content</div>
  <script>var body = "test";</script>
</body>
</html>`;
      const result = injectHotReload(html);

      // Script should be injected before the actual </body> tag
      const scriptPos = result.indexOf('data-preview-hot-reload');
      const bodyClosePos = result.lastIndexOf('</body>');
      expect(scriptPos).toBeLessThan(bodyClosePos);
    });
  });

  describe('isHtmlContent', () => {
    it('should return true for text/html', () => {
      expect(isHtmlContent('text/html')).toBe(true);
    });

    it('should return true for text/html with charset', () => {
      expect(isHtmlContent('text/html; charset=utf-8')).toBe(true);
    });

    it('should return false for text/css', () => {
      expect(isHtmlContent('text/css')).toBe(false);
    });

    it('should return false for application/javascript', () => {
      expect(isHtmlContent('application/javascript')).toBe(false);
    });

    it('should return false for application/json', () => {
      expect(isHtmlContent('application/json')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isHtmlContent('')).toBe(false);
    });
  });
});
