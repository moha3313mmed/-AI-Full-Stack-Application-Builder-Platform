# ADR 008: Live Preview with Iframe Sandbox and WebSocket Updates

## Status

Accepted

## Context

The AI Builder Platform needs to show users a live rendering of their generated project as code changes occur. The preview must update in real time as the AI generates or modifies files, support responsive testing across device sizes, and maintain security isolation between the preview content and the main application. Requirements include:

- Real-time rendering of the user's project output
- Responsive preview with mobile, tablet, and desktop viewport simulation
- Security isolation (user-generated code must not access the host application)
- Live updates without full page reloads when files change
- Visual feedback during loading and error states
- Integration with the file change notification system

Options considered:
- **Server-side rendering with screenshots**: Render pages on the server, send images to the client
- **In-browser bundler (e.g., Sandpack/CodeSandbox SDK)**: Bundle and run code entirely in the browser
- **Iframe-based sandbox with preview server**: Render the project in an isolated iframe served by a dedicated preview service
- **WebContainer (StackBlitz)**: Run a full Node.js environment in the browser via WebAssembly

## Decision

We will use an **iframe-based sandboxed preview** with a dedicated preview server, real-time WebSocket notifications for file changes, and device frame simulation for responsive testing. The implementation spans the frontend (`apps/web/src/components/preview/`) and the backend WebSocket layer (`apps/api/src/modules/files/files.gateway.ts`).

### Frontend Components

1. **`LivePreview`** (`apps/web/src/components/preview/LivePreview.tsx`): The primary preview component. Renders an iframe pointed at the preview server URL (`/preview/{projectId}`). Manages loading/error states with visual indicators. Supports refresh via key-based iframe remounting. Uses the `sandbox` attribute with `allow-scripts allow-same-origin allow-forms allow-popups` to restrict preview capabilities.

2. **`DeviceFrame`** (`apps/web/src/components/preview/DeviceFrame.tsx`): Wraps the iframe in a responsive container that simulates device dimensions:
   - Mobile: 375px width with rounded corners and notch indicator
   - Tablet: 768px width
   - Desktop: Full available width

3. **`PreviewToolbar`** (`apps/web/src/components/preview/PreviewToolbar.tsx`): Provides device size switching, manual refresh, and displays the current preview URL.

### Real-Time Update System

1. **`FilesGateway`** (`apps/api/src/modules/files/files.gateway.ts`): WebSocket gateway (Socket.IO, namespace `/files`) that authenticates clients via JWT and manages project room subscriptions. Emits events:
   - `file:created` - New file added to the project
   - `file:updated` - Existing file content changed
   - `file:deleted` - File removed
   - `file:moved` - File renamed or relocated

2. **`useFileChanges`** (`apps/web/src/hooks/useFileChanges.ts`): React hook that subscribes to file change events via the WebSocket client. On receiving change events for the active project, it invalidates relevant SWR cache entries, causing the UI (file tree, code viewer, and preview) to re-fetch updated data.

### Preview Architecture

```
Code Generation / User Edit
         |
         v
VFS (Virtual File System) updated
         |
         v
Files API persists changes
         |
         v
FilesGateway broadcasts WebSocket event
         |
         +-----> useFileChanges hook invalidates SWR cache
         |               |
         |               v
         |       File tree / Code viewer re-renders
         |
         +-----> Preview server detects file change
                        |
                        v
                 LivePreview iframe refreshes
```

### Security Model

The iframe `sandbox` attribute provides defense-in-depth:
- `allow-scripts`: Required for interactive previews (React apps need JS)
- `allow-same-origin`: Required for the preview to load its own resources
- `allow-forms`: Allows form submissions within the preview
- `allow-popups`: Allows links that open new tabs

Notably absent: `allow-top-navigation`, `allow-modals`, `allow-pointer-lock`, preventing the preview from hijacking the parent window or blocking user interaction.

## Consequences

### Positive

- **Strong isolation**: The iframe sandbox prevents user-generated code from accessing the host application's DOM, cookies, or JavaScript context
- **Framework-agnostic rendering**: Any web framework output (React, Next.js, plain HTML) renders naturally in the iframe without special bundling
- **Responsive testing**: Device frame simulation lets users verify their app across viewport sizes without leaving the editor
- **Real-time feedback**: WebSocket-driven invalidation ensures the preview reflects the latest code within milliseconds of a file change
- **Simple mental model**: The preview is a real browser rendering of the actual project output, not a simulation or approximation
- **Graceful degradation**: Loading and error states provide clear feedback when the preview server is unavailable or building

### Negative

- **Preview server dependency**: Requires a running preview build/serve process for each active project, adding infrastructure complexity
- **Cold start latency**: Initial project preview requires a build step before anything renders in the iframe
- **Full reload on changes**: Currently relies on iframe refresh rather than hot module replacement (HMR), causing a flash between updates
- **Resource consumption**: Each preview iframe runs a full browser rendering context, consuming memory proportional to project complexity
- **Cross-origin restrictions**: If the preview server runs on a different origin, some debugging and interaction features become harder to implement

### Mitigations

- The preview URL is configurable via `NEXT_PUBLIC_PREVIEW_URL` environment variable, supporting both local development and production deployment topologies
- Future enhancement: integrate an in-browser bundler (e.g., esbuild-wasm) for instant previews without a separate build server
- HMR support can be added by posting messages to the iframe rather than full remounting
- The `refreshKey` pattern in `LivePreview` ensures clean state on manual refresh without stale cached frames
- Preview server instances can be pooled and shared across projects with similar framework configurations
- SWR cache invalidation via `useFileChanges` ensures all UI components (not just preview) stay synchronized with file state
