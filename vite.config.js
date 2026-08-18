import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'www',
        emptyOutDir: true
    },
    server: {
        port: 3000,
        host: '0.0.0.0'
    }
});
