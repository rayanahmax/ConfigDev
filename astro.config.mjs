// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

import sitemap from '@astrojs/sitemap';
import { EnumChangefreq } from 'sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://configdev.com',
  trailingSlash: 'never',
  // Emit flat .html files (e.g. /about-us.html) instead of directory indexes
  // (/about-us/index.html). This removes the structural ambiguity that lets
  // web servers serve a page at BOTH /about-us and /about-us/, which is the
  // root cause of GSC "Crawled - currently not indexed" duplicate-content flags.
  build: {
    format: 'file',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Inline small assets as base64 to eliminate extra network requests
      assetsInlineLimit: 4096,
      // Split CSS per-chunk to avoid loading unused styles on every page
      cssCodeSplit: true,
    }
  },

  integrations: [
    react(),
    sitemap({
      // Exclude legal/utility pages and error pages — not useful for search indexers
      filter: (page) =>
        !page.includes('/terms') &&
        !page.includes('/privacy') &&
        !page.includes('/contact') &&
        !page.includes('/404') &&
        !page.includes('/500'),

      // Priority tiers: hero tools at 1.0, all others at 0.9
      customPages: [],
      serialize(item) {
        const heroTools = [
          'https://configdev.com/cidr-subnet-calculator',
          'https://configdev.com/pii-masker-log-scrubber',
          'https://configdev.com/k8s-manifest-sanitizer',
          'https://configdev.com/env-to-json',
          'https://configdev.com/json-to-env',
          'https://configdev.com/cron-to-systemd-converter',
          'https://configdev.com/csv-to-json-schema',
        ];
        const isHero = heroTools.some((url) => item.url === url || item.url === url + '/');
        return {
          ...item,
          priority: isHero ? 1.0 : 0.8,
          changefreq: isHero ? EnumChangefreq.WEEKLY : EnumChangefreq.MONTHLY,
        };
      },
    }),
  ],
});