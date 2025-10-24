#!/usr/bin/env node

/**
 * Development setup script
 * Run this to check your local environment before deploying
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

async function runCheck(name, checkFn) {
  try {
    await checkFn();
    checks.passed.push(name);
    console.log(`✓ ${name}`);
  } catch (error) {
    checks.failed.push({ name, error: error.message });
    console.error(`✗ ${name}: ${error.message}`);
  }
}

async function runWarning(name, checkFn) {
  try {
    await checkFn();
  } catch (error) {
    checks.warnings.push({ name, message: error.message });
    console.warn(`⚠ ${name}: ${error.message}`);
  }
}

console.log('🔍 Running pre-deployment checks...\n');

// Check Node version
await runCheck('Node.js version >= 20', async () => {
  const { stdout } = await execAsync('node --version');
  const version = parseInt(stdout.trim().slice(1).split('.')[0]);
  if (version < 20) {
    throw new Error(`Node ${version} found, need >= 20`);
  }
});

// Check if backend .env exists
await runCheck('Backend .env file exists', async () => {
  const envPath = join(process.cwd(), 'backend', '.env');
  if (!existsSync(envPath)) {
    throw new Error('Create backend/.env from backend/.env.example');
  }
});

// Check if dependencies are installed
await runCheck('Backend dependencies installed', async () => {
  const nodeModulesPath = join(process.cwd(), 'backend', 'node_modules');
  if (!existsSync(nodeModulesPath)) {
    throw new Error('Run: cd backend && npm install');
  }
});

await runCheck('Frontend dependencies installed', async () => {
  const nodeModulesPath = join(process.cwd(), 'frontend', 'node_modules');
  if (!existsSync(nodeModulesPath)) {
    throw new Error('Run: cd frontend && npm install');
  }
});

// Check if backend builds
await runCheck('Backend TypeScript compiles', async () => {
  try {
    await execAsync('cd backend && npm run typecheck');
  } catch (error) {
    throw new Error('TypeScript errors found');
  }
});

// Check if frontend builds
await runCheck('Frontend TypeScript compiles', async () => {
  try {
    await execAsync('cd frontend && npm run check');
  } catch (error) {
    throw new Error('Astro check failed');
  }
});

// Warnings for optional services
await runWarning('MongoDB connection', async () => {
  // This is optional for the check script
  throw new Error('Make sure MongoDB is running (local or Atlas)');
});

await runWarning('Redis connection', async () => {
  // This is optional for the check script
  throw new Error('Redis is optional but recommended for production');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Summary:');
console.log(`✓ Passed: ${checks.passed.length}`);
console.log(`✗ Failed: ${checks.failed.length}`);
console.log(`⚠ Warnings: ${checks.warnings.length}`);

if (checks.failed.length > 0) {
  console.log('\n❌ Failed checks:');
  checks.failed.forEach(({ name, error }) => {
    console.log(`  - ${name}: ${error}`);
  });
  process.exit(1);
}

if (checks.warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  checks.warnings.forEach(({ name, message }) => {
    console.log(`  - ${name}: ${message}`);
  });
}

console.log('\n✅ All critical checks passed!');
console.log('\n📚 Next steps:');
console.log('  1. Start MongoDB and Redis (if using locally)');
console.log('  2. Run backend: cd backend && npm run dev');
console.log('  3. Run frontend: cd frontend && npm run dev');
console.log('  4. Test API: curl http://localhost:10000/health');
console.log('  5. Open browser: http://localhost:4321');
console.log('\n🚀 Ready to deploy? See docs/RENDER_DEPLOYMENT.md');
