/**
 * MarkView Context Vault — Basic End-to-End Test
 * 
 * Tests the MCP bridge tools directly (without WebRTC)
 * to verify file listing, document reading, search, and permissions.
 * 
 * Usage: node test/e2e.js
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Create a temporary test vault directory
const TEST_DIR = path.join(os.tmpdir(), 'markview-test-vault');
const RESULTS = { passed: 0, failed: 0, errors: [] };

function assert(condition, message) {
  if (condition) {
    RESULTS.passed++;
    console.log(`  ✅ ${message}`);
  } else {
    RESULTS.failed++;
    RESULTS.errors.push(message);
    console.log(`  ❌ ${message}`);
  }
}

function setup() {
  // Create test directory with sample files
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  
  fs.writeFileSync(path.join(TEST_DIR, 'readme.md'), '# Hello World\nThis is a test document.\n');
  fs.writeFileSync(path.join(TEST_DIR, 'notes.txt'), 'Meeting notes: discuss vault features.\n');
  fs.writeFileSync(path.join(TEST_DIR, 'data.json'), '{"key": "value"}\n');
  fs.writeFileSync(path.join(TEST_DIR, '.env'), 'SECRET_KEY=abc123\n');
  fs.writeFileSync(path.join(TEST_DIR, 'passwords.txt'), 'admin:hunter2\n');
  
  fs.mkdirSync(path.join(TEST_DIR, 'subdir'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'subdir', 'nested.md'), '# Nested\nA nested file.\n');
  
  fs.mkdirSync(path.join(TEST_DIR, 'node_modules', 'fake'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'node_modules', 'fake', 'index.js'), 'blocked\n');
  
  console.log(`\nTest vault created: ${TEST_DIR}\n`);
}

function cleanup() {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
}

async function testFileDiscovery() {
  console.log('📂 File Discovery');
  
  const { findSupportedFiles } = require(path.join(__dirname, '..', 'mcp-bridge-testable'));
  const files = findSupportedFiles(TEST_DIR);
  const names = files.map(f => path.relative(TEST_DIR, f));
  
  assert(files.length >= 3, `Found ${files.length} supported files (expected ≥3)`);
  assert(names.includes('readme.md'), 'Found readme.md');
  assert(names.includes('notes.txt'), 'Found notes.txt');
  assert(names.includes('data.json'), 'Found data.json');
  assert(names.some(n => n.includes('nested.md')), 'Found nested file');
  assert(!names.some(n => n.includes('node_modules')), 'node_modules is excluded');
}

async function testFilePermissions() {
  console.log('\n🚫 File Permissions');
  
  const { isFileBlocked } = require(path.join(__dirname, '..', 'mcp-bridge-testable'));
  
  assert(isFileBlocked(path.join(TEST_DIR, '.env')), '.env is blocked');
  assert(isFileBlocked(path.join(TEST_DIR, 'passwords.txt')), '*password* is blocked');
  assert(!isFileBlocked(path.join(TEST_DIR, 'readme.md')), 'readme.md is not blocked');
  assert(!isFileBlocked(path.join(TEST_DIR, 'data.json')), 'data.json is not blocked');
}

async function testSearchDocs() {
  console.log('\n🔍 Search');
  
  const { searchDocs } = require(path.join(__dirname, '..', 'mcp-bridge-testable'));
  
  const results = await searchDocs(TEST_DIR, 'vault');
  assert(results.length >= 1, `Search "vault" found ${results.length} result(s)`);
  
  const results2 = await searchDocs(TEST_DIR, 'zzz-nonexistent');
  assert(results2.length === 0, 'Search for nonexistent term returns 0 results');
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  MarkView Context Vault — E2E Tests');
  console.log('═══════════════════════════════════════');
  
  setup();
  
  try {
    await testFileDiscovery();
    await testFilePermissions();
    await testSearchDocs();
  } catch (err) {
    console.error('\n💥 Test runner error:', err);
    RESULTS.failed++;
  }
  
  cleanup();
  
  console.log('\n═══════════════════════════════════════');
  console.log(`  Results: ${RESULTS.passed} passed, ${RESULTS.failed} failed`);
  if (RESULTS.errors.length > 0) {
    console.log(`  Failures: ${RESULTS.errors.join(', ')}`);
  }
  console.log('═══════════════════════════════════════\n');
  
  process.exit(RESULTS.failed > 0 ? 1 : 0);
}

main();
