/**
 * Builds a 100% self-contained, single-file offline HTML version of the TUSHIL Training Module:
 * - Output 1: /tushil-training-offline.html (project root, ready to copy to any PC/USB and double-click)
 * - Output 2: /public/tushil-training-offline.html (available for one-click download inside the web app)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild } from 'vite';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function generateOfflineTrainingHtml() {
  const assetsDir = path.join(rootDir, 'dist', 'assets');
  let cssFiles = fs.existsSync(assetsDir)
    ? fs.readdirSync(assetsDir).filter((f) => f.endsWith('.css'))
    : [];

  if (cssFiles.length === 0 || process.argv.includes('--rebuild-css')) {
    console.log('[1/3] Compiling Tailwind CSS via Vite...');
    await viteBuild({
      root: rootDir,
      logLevel: 'warn',
    });
    cssFiles = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir).filter((f) => f.endsWith('.css'))
      : [];
  } else {
    console.log('[1/3] Using compiled Tailwind CSS from dist/assets...');
  }

  let compiledCss = '';
  for (const cssFile of cssFiles) {
    compiledCss += fs.readFileSync(path.join(assetsDir, cssFile), 'utf8') + '\n';
  }

  console.log('[2/3] Bundling Standalone Training Module (React + Recharts + Lucide + XLSX) into a single IIFE script...');
  const result = await esbuild.build({
    entryPoints: [path.join(rootDir, 'src', 'standalone-training.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    minify: true,
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.GEMINI_API_KEY': '""',
    },
    alias: {
      '@': rootDir,
    },
    loader: {
      '.css': 'empty',
      '.png': 'dataurl',
      '.svg': 'dataurl',
      '.jpg': 'dataurl',
    },
  });

  const rawJs = result.outputFiles[0].text;
  // Prevent any literal "</script>" inside string literals from closing the HTML script tag early
  const safeJs = rawJs.replace(/<\/script/gi, '<\\/script');
  const safeCss = compiledCss.replace(/<\/style/gi, '<\\/style');

  console.log('[3/3] Assembling single-file offline HTML...');
  const htmlContent = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TUSHIL — Standalone Offline Training Module</title>
  <meta name="description" content="Self-contained single-file offline Training Module for INS Tushil. Runs 100% offline in any web browser without a server." />
  <style>${safeCss}</style>
</head>
<body class="bg-[#0a0c0f] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
  <div id="root"></div>
  <script>${safeJs}</script>
</body>
</html>`;

  const rootOutPath = path.join(rootDir, 'tushil-training-offline.html');
  const publicOutPath = path.join(rootDir, 'public', 'tushil-training-offline.html');

  fs.writeFileSync(rootOutPath, htmlContent, 'utf8');
  fs.mkdirSync(path.dirname(publicOutPath), { recursive: true });
  fs.writeFileSync(publicOutPath, htmlContent, 'utf8');

  const sizeKb = (Buffer.byteLength(htmlContent, 'utf8') / 1024).toFixed(1);
  console.log(`Done! Generated single-file offline Training HTML (${sizeKb} KB):`);
  console.log(`  -> ${rootOutPath}`);
  console.log(`  -> ${publicOutPath}`);
}

generateOfflineTrainingHtml().catch((err) => {
  console.error('Failed to generate offline Training HTML:', err);
  process.exit(1);
});
