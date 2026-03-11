import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://merak.vercel.app',
  adapter: vercel(),
  vite: {
    server: {
      host: true
    }
  }
});
