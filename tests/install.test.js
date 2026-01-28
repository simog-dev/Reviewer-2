/**
 * Installation Test Suite
 * Tests the npm installation process and verifies all dependencies are correctly installed
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const NODE_MODULES = path.join(ROOT_DIR, 'node_modules');

class TestRunner {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    try {
      fn();
      this.results.push({ name, status: 'PASS' });
      this.passed++;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      this.results.push({ name, status: 'FAIL', error: error.message });
      this.failed++;
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${error.message}`);
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
  }

  assertExists(filePath, message) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`${message}: ${filePath} does not exist`);
    }
  }

  summary() {
    console.log('\n' + '='.repeat(50));
    console.log(`Installation Tests: ${this.passed} passed, ${this.failed} failed`);
    console.log('='.repeat(50));
    return this.failed === 0;
  }
}

async function runInstallationTests() {
  console.log('\n📦 Installation Test Suite\n');
  console.log('='.repeat(50));

  const runner = new TestRunner();

  // Test 1: package.json exists and is valid
  console.log('\n1. Package Configuration\n');

  runner.test('package.json exists', () => {
    runner.assertExists(path.join(ROOT_DIR, 'package.json'), 'package.json not found');
  });

  runner.test('package.json is valid JSON', () => {
    const content = fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8');
    JSON.parse(content); // Will throw if invalid
  });

  runner.test('package.json has required fields', () => {
    const pkg = require(path.join(ROOT_DIR, 'package.json'));
    runner.assert(pkg.name, 'Missing name field');
    runner.assert(pkg.version, 'Missing version field');
    runner.assert(pkg.main, 'Missing main field');
    runner.assert(pkg.dependencies, 'Missing dependencies');
    runner.assert(pkg.devDependencies, 'Missing devDependencies');
  });

  // Test 2: Node modules installation
  console.log('\n2. Node Modules\n');

  runner.test('node_modules directory exists', () => {
    runner.assertExists(NODE_MODULES, 'node_modules not found - run npm install');
  });

  // Test 3: Core dependencies
  console.log('\n3. Core Dependencies\n');

  const coreDeps = ['electron', 'better-sqlite3', 'pdfjs-dist', 'uuid'];

  for (const dep of coreDeps) {
    runner.test(`${dep} is installed`, () => {
      const depPath = path.join(NODE_MODULES, dep);
      runner.assertExists(depPath, `${dep} not installed`);
    });

    runner.test(`${dep} package.json is valid`, () => {
      const depPkgPath = path.join(NODE_MODULES, dep, 'package.json');
      runner.assertExists(depPkgPath, `${dep}/package.json not found`);
      const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf-8'));
      runner.assert(depPkg.version, `${dep} has no version`);
    });
  }

  // Test 4: Native module (better-sqlite3) compilation
  console.log('\n4. Native Modules\n');

  runner.test('better-sqlite3 has native bindings', () => {
    const bindingsPath = path.join(NODE_MODULES, 'better-sqlite3', 'build', 'Release');
    const prebuildsPath = path.join(NODE_MODULES, 'better-sqlite3', 'prebuilds');
    const hasBindings = fs.existsSync(bindingsPath) || fs.existsSync(prebuildsPath);
    runner.assert(hasBindings, 'better-sqlite3 native bindings not found');
  });

  runner.test('better-sqlite3 can be required', () => {
    try {
      require('better-sqlite3');
    } catch (error) {
      throw new Error(`Cannot load better-sqlite3: ${error.message}`);
    }
  });

  // Test 5: PDF.js distribution
  console.log('\n5. PDF.js\n');

  runner.test('pdfjs-dist has build files', () => {
    const buildPath = path.join(NODE_MODULES, 'pdfjs-dist', 'build');
    runner.assertExists(buildPath, 'pdfjs-dist build directory not found');
  });

  runner.test('pdfjs-dist has worker file', () => {
    const workerPath = path.join(NODE_MODULES, 'pdfjs-dist', 'build', 'pdf.worker.mjs');
    const workerPathAlt = path.join(NODE_MODULES, 'pdfjs-dist', 'build', 'pdf.worker.js');
    const hasWorker = fs.existsSync(workerPath) || fs.existsSync(workerPathAlt);
    runner.assert(hasWorker, 'pdfjs-dist worker file not found');
  });

  // Test 6: Dev dependencies
  console.log('\n6. Dev Dependencies\n');

  const devDeps = ['@electron/rebuild', 'electron-builder', '@playwright/test'];

  for (const dep of devDeps) {
    runner.test(`${dep} is installed`, () => {
      const depPath = path.join(NODE_MODULES, dep);
      runner.assertExists(depPath, `${dep} not installed`);
    });
  }

  // Test 7: Electron executable
  console.log('\n7. Electron\n');

  runner.test('Electron binary exists', () => {
    const electronPath = path.join(NODE_MODULES, 'electron', 'dist');
    const electronPathAlt = path.join(NODE_MODULES, 'electron', 'path.txt');
    const hasElectron = fs.existsSync(electronPath) || fs.existsSync(electronPathAlt);
    runner.assert(hasElectron, 'Electron binary not found');
  });

  runner.test('Electron version matches', () => {
    try {
      const result = execSync('npx electron --version', {
        cwd: ROOT_DIR,
        encoding: 'utf-8',
        timeout: 30000
      });
      runner.assert(result.trim().startsWith('v'), 'Invalid Electron version');
    } catch (error) {
      throw new Error(`Cannot get Electron version: ${error.message}`);
    }
  });

  // Test 8: Application files
  console.log('\n8. Application Files\n');

  const appFiles = [
    'main.js',
    'preload.js',
    'src/index.html',
    'src/review.html',
    'src/database/db.js',
    'src/database/schema.sql',
    'src/js/home.js',
    'src/js/review.js',
    'src/js/pdf-viewer.js',
    'src/js/annotation-manager.js',
    'src/js/resizable-panels.js',
    'src/js/utils.js',
    'src/css/main.css',
    'src/css/home.css',
    'src/css/review.css',
    'src/components/pdf-card.js',
    'src/components/annotation-card.js',
    'src/components/category-filter.js'
  ];

  for (const file of appFiles) {
    runner.test(`${file} exists`, () => {
      runner.assertExists(path.join(ROOT_DIR, file), `Missing: ${file}`);
    });
  }

  // Test 9: Directory structure
  console.log('\n9. Directory Structure\n');

  const directories = [
    'src',
    'src/css',
    'src/js',
    'src/components',
    'src/database',
    'assets',
    'assets/icons'
  ];

  for (const dir of directories) {
    runner.test(`${dir}/ directory exists`, () => {
      const dirPath = path.join(ROOT_DIR, dir);
      runner.assert(fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory(),
        `${dir} is not a directory`);
    });
  }

  // Summary
  const success = runner.summary();

  // Write results to file
  const resultsPath = path.join(__dirname, 'install-test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    passed: runner.passed,
    failed: runner.failed,
    results: runner.results
  }, null, 2));

  console.log(`\nResults saved to: ${resultsPath}`);

  process.exit(success ? 0 : 1);
}

runInstallationTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
