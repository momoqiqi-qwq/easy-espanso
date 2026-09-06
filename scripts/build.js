#!/usr/bin/env node
const { execSync } = require('child_process');
const args = process.argv.slice(2);
const isFrontendOnly = args.includes('--web') || args.includes('--frontend');
const command = isFrontendOnly ? 'npm run build' : 'npm run tauri:build';
console.log(`Running: ${command}`);
execSync(command, { stdio: 'inherit' });
