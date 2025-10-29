import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  server: {
    port: 4322,
    host: true
  },
  build: {
    format: 'file'
  },
  vite: {
    css: {
      devSourcemap: true
    }
  }
});
