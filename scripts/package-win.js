const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const { version } = require('../package.json');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    ...options
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Invoke the Vite binary with Node. On Windows, npm_execpath is a .js file
// and cannot be spawned as a program.
run(process.execPath, [path.join(projectRoot, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'build']);

run(process.execPath, [path.join(projectRoot, 'scripts', 'build-win-native.js')]);

const addonDir = path.join(projectRoot, 'build', 'Release');
const addonPath = path.join(addonDir, 'native_addon.node');
fs.mkdirSync(addonDir, { recursive: true });
if (!fs.existsSync(addonPath)) {
  if (process.platform === 'win32') {
    console.error('Windows packaging requires build/Release/native_addon.node.');
    process.exit(1);
  }
  console.warn('No native_addon.node found. The installer will not include WASAPI capture, raw-input hotkeys, or native window helpers.');
  console.warn('Those features are compiled only on Windows. Run npm run build:win there for a shippable build.');
}

const trainedData = path.join(projectRoot, 'eng.traineddata');
if (!fs.existsSync(trainedData)) {
  console.error('eng.traineddata is missing from the project root. Download English tessdata before packaging.');
  process.exit(1);
}

const builderArgs = [
  path.join(projectRoot, 'node_modules', 'electron-builder', 'cli.js'),
  '--win',
  '--x64'
];

// On Windows, rcedit and NSIS run natively. Cross-builds need Wine, including
// 32-bit Wine: electron-builder uses it for rcedit and to capture the uninstaller.
if (process.platform !== 'win32') {
  const wine = spawnSync('wine', ['--version'], { stdio: 'ignore' });
  if (wine.error || wine.status !== 0) {
    console.error('Wine is required to cross-build the NSIS installer. Install wine and wine32, or run npm run build:win on Windows.');
    process.exit(1);
  }
}

// Do not pick a certificate automatically. Set CSC_LINK (and CSC_KEY_PASSWORD)
// or CSC_IDENTITY_AUTO_DISCOVERY=true on a Windows machine to sign.
const env = { ...process.env };
if (!env.CSC_IDENTITY_AUTO_DISCOVERY) env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

run(process.execPath, builderArgs, { env });

console.log(`Windows installer: ${path.join(projectRoot, 'release', `InterviewOverlay-${version}-win-x64.exe`)}`);
