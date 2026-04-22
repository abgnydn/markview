/**
 * Pre-build script: copies all transitive dependencies
 * from root node_modules to local node_modules for packaging.
 * Also handles nested node_modules inside copied packages.
 */
const fs = require('fs');
const path = require('path');

const ROOT_MODULES = path.resolve(__dirname, '..', '..', '..', 'node_modules');
const LOCAL_MODULES = path.resolve(__dirname, '..', 'node_modules');

const DIRECT_DEPS = ['mammoth', 'pdf-parse', 'werift', 'ws', 'uuid'];
const collected = new Set();

function collectDeps(moduleName, searchDir) {
  if (collected.has(moduleName)) return;
  collected.add(moduleName);

  // Try multiple locations for the package
  const locations = [
    path.join(searchDir || ROOT_MODULES, moduleName, 'package.json'),
    path.join(ROOT_MODULES, moduleName, 'package.json'),
  ];

  for (const pkgPath of locations) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const subDeps = Object.keys(pkg.dependencies || {});
      const parentDir = path.dirname(path.dirname(pkgPath));
      for (const dep of subDeps) {
        collectDeps(dep, parentDir);
      }
      break;
    } catch (e) {
      // Try next location
    }
  }
}

// Also scan for nested node_modules inside each already-copied package
function findNestedDeps(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' && entry.isDirectory()) {
        const nestedDir = path.join(dir, entry.name);
        const nested = fs.readdirSync(nestedDir, { withFileTypes: true });
        for (const n of nested) {
          if (n.isDirectory() && !n.name.startsWith('.')) {
            if (n.name.startsWith('@')) {
              // Scoped package
              const scopeDir = path.join(nestedDir, n.name);
              const scopedPkgs = fs.readdirSync(scopeDir, { withFileTypes: true });
              for (const sp of scopedPkgs) {
                if (sp.isDirectory()) {
                  const name = `${n.name}/${sp.name}`;
                  if (!collected.has(name)) {
                    collectDeps(name, nestedDir);
                  }
                }
              }
            } else {
              if (!collected.has(n.name)) {
                collectDeps(n.name, nestedDir);
              }
            }
          }
        }
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        findNestedDeps(path.join(dir, entry.name));
      }
    }
  } catch (e) {}
}

// Collect all transitive deps
DIRECT_DEPS.forEach(d => collectDeps(d, ROOT_MODULES));

// Also scan root node_modules for nested deps inside our direct deps
for (const dep of [...collected]) {
  findNestedDeps(path.join(ROOT_MODULES, dep));
}

console.log(`Found ${collected.size} packages to copy`);

// Remove old local node_modules and recreate
if (fs.existsSync(LOCAL_MODULES)) {
  fs.rmSync(LOCAL_MODULES, { recursive: true });
}
fs.mkdirSync(LOCAL_MODULES, { recursive: true });

let copied = 0;
let missing = 0;

for (const dep of collected) {
  const src = path.join(ROOT_MODULES, dep);
  const dst = path.join(LOCAL_MODULES, dep);

  // Handle scoped packages
  if (dep.startsWith('@')) {
    const scopeDir = path.join(LOCAL_MODULES, dep.split('/')[0]);
    fs.mkdirSync(scopeDir, { recursive: true });
  }

  if (fs.existsSync(src)) {
    fs.cpSync(src, dst, { recursive: true });
    copied++;
  } else {
    console.warn(`  WARN: ${dep} not at root, checking if nested...`);
    missing++;
  }
}

console.log(`Copied ${copied} packages, ${missing} not at root`);
console.log(`Done!`);
