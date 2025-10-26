import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://docs.astro.build/en/guides/configuring-astro/
export default defineConfig({
    site: 'https://whyknot.live',
    output: 'static',
    adapter: node({
        mode: 'standalone'
    }),
    server: {
        port: Number(process.env.PORT) || 4321,
        host: process.env.HOST || '0.0.0.0'
    },
    build: {
        inlineStylesheets: 'auto',
        assets: '_astro',
        format: 'directory'
    },
    compressHTML: true,
    // Use an intent-based prefetch strategy to avoid unnecessary bandwidth usage
    prefetch: {
        defaultStrategy: 'hover'
    },
    experimental: {
        contentIntellisense: true
    },
    vite: {
        build: {
            rollupOptions: {
                output: {
                    manualChunks: undefined
                }
            }
        }
    }
});
