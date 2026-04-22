import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const config = {
  entryPoints: {
    background: 'src/background.ts',
    offscreen: 'src/offscreen.ts',
    content: 'src/content.ts',
    popup: 'src/popup.ts',
  },
  bundle: false,
  outdir: 'dist',
  format: 'esm',
  target: 'es2022',
  sourcemap: false,
  logLevel: 'info',
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(config);
  console.log('Build complete.');
}
