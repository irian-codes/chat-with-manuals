import react from '@vitejs/plugin-react';
import {loadEnv} from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'node',
    testTimeout: 30000,
    env: loadEnv('testing', process.cwd()),
  },
});
