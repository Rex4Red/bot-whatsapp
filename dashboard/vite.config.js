import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3005',
                changeOrigin: true,
            },
            '/socket.io': {
                target: 'http://localhost:3005',
                ws: true,
            },
        },
    },
    build: {
        outDir: '../public',
        emptyOutDir: true,
    },
});
