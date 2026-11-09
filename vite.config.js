import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { raceRoomPlugin } from './raceRoomPlugin.js';

export default defineConfig({
  plugins: [react(), raceRoomPlugin()],
  server: {
    port: 5173,
    host: true,
  }
});
