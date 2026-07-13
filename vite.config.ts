import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

// Automatically update src/buildTime.ts with the current timestamp on every compilation / server load
try {
  const buildTimePath = path.resolve(__dirname, 'src/buildTime.ts');
  const now = new Date().toISOString();
  fs.writeFileSync(buildTimePath, `// This file is auto-updated with the compilation timestamp of the application\nexport const BUILD_TIME = '${now}';\n`);
} catch (e) {
  console.error('Failed to auto-write buildTime.ts', e);
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
