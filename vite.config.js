import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'kip.js',
      name: 'Kip',
      fileName: format => `kip.${format}.js`,
      formats: ['es', 'umd'],
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
