/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Driftless/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'] },
      manifest: {
        name: 'Driftless',
        short_name: 'Driftless',
        description: 'A deep-focus timer. Pick a destination, launch, and stay on course.',
        theme_color: '#0b1026',
        background_color: '#0b1026',
        display: 'standalone',
        start_url: '/Driftless/',
        scope: '/Driftless/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // vitest runs the unit suite under src only; Playwright owns e2e/
  test: { environment: 'jsdom', include: ['src/**/*.{test,spec}.{ts,tsx}'] },
});
