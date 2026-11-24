const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform !== 'win32') {
  console.log('Skipping the Windows native addon build. node-gyp for this addon requires Windows and MSVC.');
  process.exit(0);
}

const projectRoot = path.resolve(__dirname, '..');
const electronPackage = require(path.join(path.dirname(require.resolve('electron/package.json')), 'package.json'));
const nodeGyp = require.resolve('node-gyp/bin/node-gyp.js');
const arch = 'x64';

console.log(`Building native_addon for Electron ${electronPackage.version} ${arch}...`);

const result = spawnSync(process.execPath, [
  nodeGyp,
  'rebuild',
  '--runtime=electron',
  `--target=${electronPackage.version}`,
  '--dist-url=https://electronjs.org/headers',
  `--arch=${arch}`
], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit'
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const addonPath = path.join(projectRoot, 'build', 'Release', 'native_addon.node');
if (!fs.existsSync(addonPath)) {
  console.error(`Native build finished without ${addonPath}`);
  process.exit(1);
}

console.log(`Built ${addonPath}`);
