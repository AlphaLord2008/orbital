import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
// One build per library so bundle cost can be compared: --mode radix | rac
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  build: { rollupOptions: { input: mode === 'radix' ? 'radix.html' : 'rac.html' } },
}));
