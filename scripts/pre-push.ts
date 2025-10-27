#!/usr/bin/env tsx

/**
 * Pre-push validation script
 * Runs all checks that would run on CircleCI/GitHub Actions
 * to ensure no failures in CI/CD pipeline
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

interface CheckResult {
 name: string;
 success: boolean;
 duration: number;
 error?: string;
}

class PrePushValidator {
 private results: CheckResult[] = [];
 private rootDir: string;

 constructor() {
 this.rootDir = path.resolve(__dirname, '..');
 }

 private log(message: string, color: string = RESET) {
 console.log(`${color}${message}${RESET}`);
 }

 private logSection(title: string) {
 console.log('\n' + '='.repeat(60));
 this.log(` ${title}`, CYAN);
 console.log('='.repeat(60) + '\n');
 }

 private async runCommand(
 command: string,
 cwd: string,
 name: string
 ): Promise<CheckResult> {
 const startTime = Date.now();
 
 try {
 this.log(` Running: ${name}`, BLUE);
 
 execSync(command, {
 cwd,
 stdio: 'inherit',
 env: {...process.env, FORCE_COLOR: '1' }
 });
 
 const duration = Date.now() - startTime;
 this.log(`[check] ${name} passed (${duration}ms)`, GREEN);
 
 return { name, success: true, duration };
 } catch (error) {
 const duration = Date.now() - startTime;
 this.log(`[x] ${name} failed (${duration}ms)`, RED);
 
 return {
 name,
 success: false,
 duration,
 error: error instanceof Error ? error.message : String(error)
 };
 }
 }

 private async checkBackend(): Promise<CheckResult[]> {
 this.logSection('Backend Checks');
 
 const backendDir = path.join(this.rootDir, 'backend');
 
 if (!existsSync(backendDir)) {
 this.log('[warning] Backend directory not found, skipping', YELLOW);
 return [];
 }

 const checks: CheckResult[] = [];

 // Install dependencies - use install if ci fails
 const installResult = await this.runCommand(
 'bun install --frozen-lockfile 2>/dev/null || bun install',
 backendDir,
 'Backend: Install dependencies'
 );
 checks.push(installResult);
 
 // Skip other checks if install failed
 if (!installResult.success) {
 this.log('[warning] Skipping backend checks due to install failure', YELLOW);
 return checks;
 }

 // TypeScript type checking
 checks.push(
 await this.runCommand(
 'bun run typecheck',
 backendDir,
 'Backend: TypeScript check'
 )
 );

 // Linting
 checks.push(
 await this.runCommand(
 'bun run lint',
 backendDir,
 'Backend: Lint'
 )
 );

 // Tests
 checks.push(
 await this.runCommand(
 'bun test',
 backendDir,
 'Backend: Tests'
 )
 );

 // Build
 checks.push(
 await this.runCommand(
 'bun run build',
 backendDir,
 'Backend: Build'
 )
 );

 return checks;
 }

 private async checkFrontend(): Promise<CheckResult[]> {
 this.logSection('Frontend Checks');
 
 const frontendDir = path.join(this.rootDir, 'frontend');
 
 if (!existsSync(frontendDir)) {
 this.log('[warning] Frontend directory not found, skipping', YELLOW);
 return [];
 }

 const checks: CheckResult[] = [];

 // Install dependencies - use install if ci fails
 const installResult = await this.runCommand(
 'bun install --frozen-lockfile 2>/dev/null || bun install',
 frontendDir,
 'Frontend: Install dependencies'
 );
 checks.push(installResult);

 // Skip other checks if install failed
 if (!installResult.success) {
 this.log('[warning] Skipping frontend checks due to install failure', YELLOW);
 return checks;
 }

 // Astro type checking
 checks.push(
 await this.runCommand(
 'bun run check',
 frontendDir,
 'Frontend: Astro check'
 )
 );

 // Linting
 checks.push(
 await this.runCommand(
 'bun run lint',
 frontendDir,
 'Frontend: Lint'
 )
 );

 // Build
 checks.push(
 await this.runCommand(
 'bun run build',
 frontendDir,
 'Frontend: Build'
 )
 );

 return checks;
 }

 private async securityAudit(): Promise<CheckResult[]> {
 this.logSection('Security Audit');
 
 const checks: CheckResult[] = [];

 // Backend security audit (informational only, don't fail)
 const backendDir = path.join(this.rootDir, 'backend');
 if (existsSync(backendDir)) {
 const startTime = Date.now();
 try {
 this.log(' Running: Backend security audit', BLUE);
 // Use bun's audit command instead of npm
 execSync('bun pm audit || true', {
 cwd: backendDir,
 stdio: 'inherit'
 });
 const duration = Date.now() - startTime;
 this.log(`ℹ Backend audit complete (${duration}ms)`, YELLOW);
 checks.push({ name: 'Backend: Security audit', success: true, duration });
 } catch (error) {
 const duration = Date.now() - startTime;
 checks.push({
 name: 'Backend: Security audit',
 success: true, // Don't fail on audit
 duration,
 error: 'Audit found vulnerabilities (informational)'
 });
 }
 }

 // Frontend security audit (informational only, don't fail)
 const frontendDir = path.join(this.rootDir, 'frontend');
 if (existsSync(frontendDir)) {
 const startTime = Date.now();
 try {
 this.log(' Running: Frontend security audit', BLUE);
 // Use bun's audit command instead of npm
 execSync('bun pm audit || true', {
 cwd: frontendDir,
 stdio: 'inherit'
 });
 const duration = Date.now() - startTime;
 this.log(`ℹ Frontend audit complete (${duration}ms)`, YELLOW);
 checks.push({ name: 'Frontend: Security audit', success: true, duration });
 } catch (error) {
 const duration = Date.now() - startTime;
 checks.push({
 name: 'Frontend: Security audit',
 success: true, // Don't fail on audit
 duration,
 error: 'Audit found vulnerabilities (informational)'
 });
 }
 }

 return checks;
 }

 private printSummary() {
 this.logSection('Summary');
 
 const totalChecks = this.results.length;
 const passedChecks = this.results.filter(r => r.success).length;
 const failedChecks = totalChecks - passedChecks;
 const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

 console.log(`Total checks: ${totalChecks}`);
 this.log(`Passed: ${passedChecks}`, GREEN);
 if (failedChecks > 0) {
 this.log(`Failed: ${failedChecks}`, RED);
 }
 console.log(`Total time: ${(totalDuration / 1000).toFixed(2)}s\n`);

 if (failedChecks > 0) {
 this.logSection('Failed Checks');
 this.results
.filter(r => !r.success)
.forEach(r => {
 this.log(`[x] ${r.name}`, RED);
 if (r.error) {
 console.log(` ${r.error}`);
 }
 });
 console.log();
 }
 }

 async run(): Promise<boolean> {
 console.clear();
 this.log('\n[rocket] Pre-Push Validation', CYAN);
 this.log('Running all CI/CD checks locally...\n', CYAN);

 const startTime = Date.now();

 // Run all checks
 const backendResults = await this.checkBackend();
 const frontendResults = await this.checkFrontend();
 const securityResults = await this.securityAudit();

 this.results = [...backendResults,...frontendResults,...securityResults];

 const totalTime = Date.now() - startTime;

 this.printSummary();

 const allPassed = this.results.every(r => r.success);

 if (allPassed) {
 this.log('[check] All checks passed! Safe to push.', GREEN);
 this.log(`\nTotal validation time: ${(totalTime / 1000).toFixed(2)}s\n`, CYAN);
 return true;
 } else {
 this.log('[x] Some checks failed. Please fix errors before pushing.', RED);
 this.log(`\nTotal validation time: ${(totalTime / 1000).toFixed(2)}s\n`, CYAN);
 return false;
 }
 }
}

// Run the validator
const validator = new PrePushValidator();
validator.run().then(success => {
 process.exit(success ? 0 : 1);
}).catch(error => {
 console.error(`${RED}Fatal error:${RESET}`, error);
 process.exit(1);
});
