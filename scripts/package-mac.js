const { spawnSync } = require('child_process');
const path = require('path');

if (process.platform !== 'darwin') {
  console.error('The macOS package must be created on macOS.');
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
const { version } = require('../package.json');
const appPath = path.join(projectRoot, 'release', 'mac-arm64', 'InterviewOverlay.app');
const zipPath = path.join(projectRoot, 'release', `InterviewOverlay-${version}-arm64-mac.zip`);
const dmgPath = path.join(projectRoot, 'release', `InterviewOverlay-${version}-arm64.dmg`);
const DEFAULT_SIGN_IDENTITY = 'InterviewOverlay Local Signing';

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

function resolveSignIdentity() {
  const requested = process.env.MAC_SIGN_IDENTITY || DEFAULT_SIGN_IDENTITY;
  const result = spawnSync('security', ['find-identity', '-p', 'codesigning'], {
    encoding: 'utf8'
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (output.includes(`"${requested}"`)) {
    return requested;
  }
  return null;
}

run(process.execPath, [path.join(projectRoot, 'scripts/build-mac-audio.cjs')]);
run(process.env.npm_execpath, ['run', 'build']);

const electronBuilder = path.join(projectRoot, 'node_modules', '.bin', 'electron-builder');
run(electronBuilder, ['--mac', '--arm64', '--dir'], {
  env: {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false'
  }
});

const identity = resolveSignIdentity();
if (identity) {
  console.log(`Signing with identity "${identity}"`);
  run('codesign', ['--force', '--deep', '--sign', identity, appPath]);
} else {
  const requested = process.env.MAC_SIGN_IDENTITY || DEFAULT_SIGN_IDENTITY;
  console.warn(
    `Signing identity "${requested}" was not found in the keychain; signing ad-hoc. ` +
      'Run `npm run create:mac-signing-cert` so Screen Recording and microphone grants persist across rebuilds.'
  );
  run('codesign', ['--force', '--deep', '--sign', '-', appPath]);
}
run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);

run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath]);
run('hdiutil', [
  'create',
  '-volname', 'InterviewOverlay',
  '-srcfolder', appPath,
  '-ov',
  '-format', 'UDZO',
  dmgPath
]);

console.log(`Created ${dmgPath}`);
console.log(`Created ${zipPath}`);
