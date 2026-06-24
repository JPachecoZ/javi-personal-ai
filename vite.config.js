import { defineConfig } from 'vite';

// Vite dev server already serves over http://localhost, which is a "secure
// origin" — required for getUserMedia (mic) and the Web Speech APIs to work.
// Opening the file via file:// would block the microphone, so always use `npm run dev`.
export default defineConfig({
  root: '.',
  server: {
    port: 8080,
    host: 'localhost',
    open: false,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
