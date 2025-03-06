import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

const plugins = [
  typescript({
    tsconfig: './tsconfig.json',
    noEmitOnError: true,
    exclude: ['examples/**/*', 'node_modules/**/*'],
    compilerOptions: {
      module: 'esnext',
      target: 'es2022',
      isolatedModules: true,
      esModuleInterop: true,
      outDir: 'dist',
    },
  }),
  resolve({
    extensions: ['.ts', '.js', '.json'],
    preferBuiltins: true,
    mainFields: ['module', 'main', 'browser'],
  }),
  commonjs({
    extensions: ['.js', '.ts'],
    ignoreDynamicRequires: true,
    requireReturnsDefault: 'preferred',
  }),
];

const config = {
  input: {
    'api-clients/index': 'src/api-clients/index.ts',
    'sdk/index': 'src/sdk/index.ts',
    'base-packers/index': 'src/base-packers/index.ts',
    'common-packers/index': 'src/common-packers/index.ts',
  },
  output: [
    {
      dir: 'dist',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      entryFileNames: '[name].js',
      preserveModules: true,
      preserveModulesRoot: 'src',
    },
    {
      dir: 'dist',
      format: 'es',
      sourcemap: true,
      exports: 'named',
      entryFileNames: '[name].esm.js',
      preserveModules: true,
      preserveModulesRoot: 'src',
    },
  ],
  plugins,
  external,
  onwarn(warning, warn) {
    if (warning.code === 'THIS_IS_UNDEFINED') return;
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  },
};

export default config;
