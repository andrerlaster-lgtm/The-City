import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // React rarely changes, so it gets its own long-cached vendor chunk. Pixi stays with
        // the app: grouping it would also swallow the renderer pieces Pixi loads lazily
        // (WebGL vs WebGPU, workers), so every visitor would download all of them.
        codeSplitting: {
          groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
