/**
 * Injects a hot-reload script into HTML content.
 * The script connects to the preview server's WebSocket and
 * triggers a page reload when a file-change notification is received.
 */

const HOT_RELOAD_SCRIPT = `
<script data-preview-hot-reload>
(function() {
  var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var wsUrl = protocol + '//' + location.host + '/ws';
  var ws;
  var reconnectInterval = 1000;

  function connect() {
    ws = new WebSocket(wsUrl);

    ws.onopen = function() {
      console.log('[Preview] Hot-reload connected');
      reconnectInterval = 1000;
    };

    ws.onmessage = function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'reload') {
          console.log('[Preview] Reloading...');
          location.reload();
        }
      } catch (e) {
        // Ignore malformed messages
      }
    };

    ws.onclose = function() {
      console.log('[Preview] Connection lost, reconnecting...');
      setTimeout(connect, reconnectInterval);
      reconnectInterval = Math.min(reconnectInterval * 2, 5000);
    };

    ws.onerror = function() {
      ws.close();
    };
  }

  connect();
})();
</script>
`;

/**
 * Injects the hot-reload script into HTML content.
 * The script is inserted just before the closing </body> tag if present,
 * otherwise before the closing </html> tag, otherwise appended to the end.
 */
export function injectHotReload(html: string): string {
  // Try to inject before </body>
  const bodyCloseIndex = html.lastIndexOf('</body>');
  if (bodyCloseIndex !== -1) {
    return html.slice(0, bodyCloseIndex) + HOT_RELOAD_SCRIPT + html.slice(bodyCloseIndex);
  }

  // Try to inject before </html>
  const htmlCloseIndex = html.lastIndexOf('</html>');
  if (htmlCloseIndex !== -1) {
    return html.slice(0, htmlCloseIndex) + HOT_RELOAD_SCRIPT + html.slice(htmlCloseIndex);
  }

  // Append to end if no closing tags found
  return html + HOT_RELOAD_SCRIPT;
}

/**
 * Check if a MIME type represents HTML content.
 */
export function isHtmlContent(mimeType: string): boolean {
  return mimeType === 'text/html' || mimeType.startsWith('text/html;');
}

export { HOT_RELOAD_SCRIPT };
