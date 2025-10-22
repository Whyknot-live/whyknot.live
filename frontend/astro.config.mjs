import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://docs.astro.build/en/guides/configuring-astro/
export default defineConfig({
    site: 'https://whyknot.live',
    output: 'server',
    adapter: node({
        mode: 'standalone'
    }),
    build: {
        inlineStylesheets: 'auto',
        assets: '_astro'
    },
    compressHTML: true,
    // Use an intent-based prefetch strategy to avoid unnecessary bandwidth usage
    prefetch: {
        defaultStrategy: 'hover'
    },
    experimental: {
        contentIntellisense: true
    }
});
