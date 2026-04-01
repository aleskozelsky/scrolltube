import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    fs: {
      // Allow serving files from one level up (the packages directory) 
      // so we can access ../../scrolltube/dist
      allow: ['..', '../../scrolltube']
    }
  }
});
