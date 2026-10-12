import { defineConfig } from 'vite';

// The project lives on a Windows drive mounted into WSL (/mnt/*), where inotify events
// are not delivered; polling keeps the dev server's module cache in sync with edits.
export default defineConfig({
  server: {
    watch: { usePolling: process.cwd().startsWith('/mnt/'), interval: 300 },
  },
  build: { chunkSizeWarningLimit: 800 },
});
