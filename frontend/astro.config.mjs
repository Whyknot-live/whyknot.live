import { defineConfig } from 'astro/config';

// https://docs.astro.build/en/guides/configuring-astro/
export default defineConfig({
    site: 'https://www.whyknot.live',
    output: 'static',
    server: {
        port: 4321,
        host: '0.0.0.0'
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
