import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Root-absolute: the site is served from the apex of novogenics.co.uk,
  // index.html already references /icons, /manifest.json etc. absolutely,
  // and public/404.html can be served from any depth without breaking the
  // asset URLs it hands back to the browser.
  base: '/',
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':    ['react', 'react-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'motion-vendor':   ['motion/react'],
          'admin-panels':    [
            './pages/admin/panels/TodayPanel',
            './pages/admin/panels/InboxPanel',
            './pages/admin/panels/CalendarPanel',
            './pages/admin/panels/ClientsPanel',
            './pages/admin/panels/MoneyPanel',
            './pages/admin/panels/PlatformHealthPanel',
            './pages/admin/ClientRecord',
          ],
          // InsightsPanel + MarketingPanel are intentionally NOT listed here:
          // they're React.lazy-loaded in PracticePanel so Recharts splits into
          // its own on-demand chunk instead of bloating admin-panels.
        },
      },
    },
  },
});
