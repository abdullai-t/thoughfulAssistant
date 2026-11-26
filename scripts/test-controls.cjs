const assert = require('node:assert/strict');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { buildSync } = require('esbuild');
const path = require('node:path');

function load(file, electron, platform = 'darwin') {
  const code = buildSync({ entryPoints: [path.resolve(__dirname, '..', file)], bundle: true,
    platform: 'node', format: 'cjs', external: ['electron'], write: false }).outputFiles[0].text;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, __dirname: __dirname, Buffer, setTimeout,
    process: { platform, resourcesPath: '/unavailable' },
    setInterval, clearInterval,
    console: { log() {}, warn() {}, error() {} },
    require: name => name === 'electron' ? electron : require(name)
  });
  return module.exports;
}
const { defaultHotkeys, migrateControls, acceleratorFor, shortcutLabel, isReservedWindowsBinding } = load('src/shared/controls.ts');
const mac = defaultHotkeys('darwin');
assert.equal(acceleratorFor(mac.toggleOverlay.vkCodes, 'darwin'), 'Command+\\');
assert.equal(acceleratorFor(mac.chat.vkCodes, 'darwin'), 'Command+Enter');
assert.equal(acceleratorFor(mac.askAi.vkCodes, 'darwin'), 'Command+Shift+Enter');
assert.equal(shortcutLabel([0x11, 0x12, 0x25], 'darwin'), '⌘⌥←');
const old = defaultHotkeys('win32');
old.captureScreen = { vkCodes: [0xA2, 0x12, 0x4B], label: 'custom stale label' };
const migrated = migrateControls(old, 'darwin', 0);
assert.equal(migrated.toggleOverlay.label, '⌘\\');
assert.equal(migrated.askAi.label, '⌘⇧↵');
assert.equal(migrated.captureScreen.label, '⌘⌥K');
assert.equal(migrated.cancelStream.label, '⌘⇧X');
assert.deepEqual(migrateControls(migrated, 'darwin', 1), migrated);
assert.equal(migrateControls(old, 'win32', 0).askAi.label, 'Ctrl+Shift+A');
assert.equal(new Set(Object.values(mac).map(b => acceleratorFor(b.vkCodes, 'darwin'))).size, Object.keys(mac).length);
const macLabels = {
  toggleOverlay: '⌘\\', chat: '⌘↵', askAi: '⌘⇧↵', captureScreen: '⌘⇧S', toggleRecording: '⌘⇧R',
  toggleInteract: '⌘⇧I', cancelStream: '⌘⇧X', resetAll: '⌘⇧N', scrollUp: '⌘⇧↑', scrollDown: '⌘⇧↓',
  quitApp: '⌘⌥Q', moveWindowUp: '⌘⌥↑', moveWindowDown: '⌘⌥↓', moveWindowLeft: '⌘⌥←',
  moveWindowRight: '⌘⌥→', hideApp: '⌘⇧H', toggleTypingMode: '⌘⇧W'
};
for (const [name, label] of Object.entries(macLabels)) assert.equal(mac[name].label, label, name);
const windowsDefaults = defaultHotkeys('win32');
const winLabels = {
  toggleOverlay: 'Ctrl+Shift+H', chat: 'Ctrl+Enter', askAi: 'Ctrl+Shift+A', captureScreen: 'Ctrl+Shift+S',
  toggleRecording: 'Ctrl+Shift+R', toggleInteract: 'Ctrl+Shift+I', cancelStream: 'Ctrl+Shift+X',
  resetAll: 'Ctrl+Shift+N', scrollUp: 'Ctrl+Shift+Up', scrollDown: 'Ctrl+Shift+Down', quitApp: 'Ctrl+Shift+Q',
  moveWindowUp: 'Ctrl+Alt+Shift+Up', moveWindowDown: 'Ctrl+Alt+Shift+Down', moveWindowLeft: 'Ctrl+Alt+Shift+Left',
  moveWindowRight: 'Ctrl+Alt+Shift+Right', hideApp: 'Ctrl+H', toggleTypingMode: 'Ctrl+Shift+W'
};
for (const [name, label] of Object.entries(winLabels)) {
  assert.equal(windowsDefaults[name].label, label, name);
  assert.equal(windowsDefaults[name].label.includes('⌘') || windowsDefaults[name].label.includes('⌥'), false);
  assert.equal(isReservedWindowsBinding(windowsDefaults[name].vkCodes), false, name);
}
assert.equal(isReservedWindowsBinding([0x1B]), true);
assert.equal(isReservedWindowsBinding([0x11, 0x12, 0x26]), true);
assert.equal(isReservedWindowsBinding([0x12, 0x73]), true);
assert.equal(isReservedWindowsBinding([0x5B, 0x45]), true);
const legacyWin = defaultHotkeys('win32');
legacyWin.cancelStream = { vkCodes: [0x1B], label: 'Escape' };
legacyWin.moveWindowLeft = { vkCodes: [0x11, 0x12, 0x25], label: 'Ctrl+Alt+Left' };
legacyWin.askAi = { vkCodes: [0x11, 0x10, 0x42], label: 'custom' };
const upgraded = migrateControls(legacyWin, 'win32', 1);
assert.equal(upgraded.cancelStream.label, 'Ctrl+Shift+X');
assert.equal(upgraded.moveWindowLeft.label, 'Ctrl+Alt+Shift+Left');
assert.equal(upgraded.askAi.label, 'Ctrl+Shift+B');
assert.equal(migrateControls(legacyWin, 'win32', 2).cancelStream.label, 'Escape');
const legacyOnMac = migrateControls({
  toggleOverlay: { vkCodes: [0x11, 0x10, 0x48], label: 'Ctrl+Shift+H' },
  cancelStream: { vkCodes: [0x1B], label: 'Escape' },
  moveWindowUp: { vkCodes: [0x11, 0x12, 0x26], label: 'Ctrl+Alt+Up' }
}, 'darwin', 0);
assert.equal(legacyOnMac.toggleOverlay.label, '⌘\\');
assert.equal(legacyOnMac.cancelStream.label, '⌘⇧X');
assert.equal(legacyOnMac.moveWindowUp.label, '⌘⌥↑');
const { isWindowDragTarget } = load('src/shared/window-drag.ts');
const dragNode = (token) => ({ closest: (selector) => selector.includes(token) ? { token } : null });
assert.equal(isWindowDragTarget(dragNode('.overlay-panel')), true);
assert.equal(isWindowDragTarget(dragNode('.settings-topbar')), true);
assert.equal(isWindowDragTarget(dragNode('button')), false);
assert.equal(isWindowDragTarget(dragNode('textarea')), false);
assert.equal(isWindowDragTarget(dragNode('.tab-content')), false);
assert.equal(isWindowDragTarget(dragNode('.audio-panel')), false);
assert.equal(isWindowDragTarget(null), false);
console.log('PASS: Mac mappings, legacy migration, custom bindings, idempotence, Windows defaults, no collisions');

class MockWindow extends EventEmitter {
  constructor(options) {
    super(); this.options = options; this.visible = false; this.focused = false;
    this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
    this.events = []; this.webContents = { send: (...args) => this.events.push(args), isDestroyed: () => false };
  }
  setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {}
  setContentProtection(value) { this.protected = value; }
  isContentProtected() { return this.protected; }
  setIgnoreMouseEvents(value) { this.ignoring = value; }
  setFocusable(value) { this.focusable = value; }
  focus() { this.focused = true; }
  blur() { this.focused = false; }
  isFocused() { return this.focused; }
  isVisible() { return this.visible; }
  isDestroyed() { return false; }
  showInactive() { assert.equal(this.focused, false); this.visible = true; this.emit('show'); }
  hide() { this.visible = false; this.emit('hide'); }
  getBounds() { return this.bounds; }
  getPosition() { return [this.bounds.x, this.bounds.y]; }
  setPosition(x, y) { Object.assign(this.bounds, { x, y }); }
  setSize(width, height) { Object.assign(this.bounds, { width, height }); }
  setSkipTaskbar(value) { this.skipTaskbar = value; this.skipTaskbarCalls = (this.skipTaskbarCalls || 0) + 1; }
  getNativeWindowHandle() { return Buffer.alloc(8); }
}
const display = { workArea: { x: 0, y: 25, width: 1200, height: 775 }, workAreaSize: { width: 1200, height: 775 } };
const cursor = { x: 0, y: 0 };
const { WindowManager } = load('src/main/window-manager.ts', {
  BrowserWindow: MockWindow,
  screen: {
    getPrimaryDisplay: () => display,
    getDisplayMatching: () => display,
    getCursorScreenPoint: () => ({ x: cursor.x, y: cursor.y })
  }
});
const manager = new WindowManager();
const win = manager.createOverlayWindow({ x: 100, y: 100, width: 500, height: 600, opacity: 0.85 });
assert.equal(win.options.show, false);
assert.equal(win.options.type, undefined);
assert.equal(win.options.skipTaskbar, true);
assert.equal(win.skipTaskbarCalls || 0, 0, 'macOS must not reapply Windows taskbar hiding');
assert.equal(win.protected, true);
assert.equal(manager.getState().contentProtection, 'requested');
assert.match(manager.getState().protectionNote, /ScreenCaptureKit/);
win.emit('ready-to-show');
assert.equal(win.visible, true);
assert.equal(win.focused, false);
manager.setContentProtection(false); manager.hide(); manager.stealthShow();
assert.equal(win.protected, false, 'show must not silently re-enable disabled protection');
manager.toggleVisibility(); assert.equal(win.visible, false);
manager.stealthShow(); manager.toggleVisibility(); assert.equal(win.visible, false, 'toggle reads native visibility');
manager.setFullPassthrough(true); assert.equal(win.ignoring, true);
manager.handleSmartHitTest(false); assert.equal(win.ignoring, true);
manager.setFullPassthrough(false); assert.equal(win.ignoring, false, 'immediate click-through recovery');
manager.setFocusableForInput(true); assert.equal(win.visible, true); assert.equal(win.focused, true);
manager.setFocusableForInput(false); assert.equal(win.focused, false);
manager.moveBy(-10000, 10000); assert.equal(win.bounds.x, 0); assert.equal(win.bounds.y, 200);
win.setContentProtection = () => { throw new Error('unsupported'); };
manager.setContentProtection(true); assert.equal(manager.getState().contentProtection, 'unavailable');
manager.stealthShow();
manager.setFullPassthrough(true);
cursor.x = 10; cursor.y = 10;
manager.beginDrag();
cursor.x = 80; cursor.y = 80;
manager.dragMove();
assert.equal(win.bounds.x, 0, 'click-through does not drag');
assert.equal(win.bounds.y, 200);
manager.endDrag();
manager.setFullPassthrough(false);
const [dragStartX, dragStartY] = win.getPosition();
cursor.x = 400; cursor.y = 400;
manager.beginDrag();
assert.equal(win.ignoring, false);
cursor.x = 430; cursor.y = 360;
manager.dragMove();
assert.equal(win.getPosition()[0], dragStartX + 30);
assert.equal(win.getPosition()[1], dragStartY - 40);
manager.handleSmartHitTest(true);
assert.equal(win.ignoring, false, 'drag keeps mouse events');
manager.endDrag();
const frozenX = win.getPosition()[0];
cursor.x = 900;
manager.dragMove();
assert.equal(win.getPosition()[0], frozenX);
console.log('PASS: protection before show, opt-out persistence, no focus steal, hide/show, click-through, focus release, bounds, failure status');

const { WindowManager: WindowsWindowManager } = load('src/main/window-manager.ts', {
  BrowserWindow: MockWindow,
  screen: {
    getPrimaryDisplay: () => display,
    getDisplayMatching: () => display,
    getCursorScreenPoint: () => ({ x: 0, y: 0 })
  }
}, 'win32');
const windowsManager = new WindowsWindowManager();
const windowsWin = windowsManager.createOverlayWindow({ x: 10, y: 10, width: 400, height: 300, opacity: 1, captureProtection: true });
assert.equal(windowsWin.options.type, 'toolbar');
assert.equal(windowsWin.options.skipTaskbar, true);
assert.equal(windowsWin.protected, true);
assert.ok(windowsWin.skipTaskbarCalls > 0);
const beforeShow = windowsWin.skipTaskbarCalls;
windowsWin.emit('ready-to-show');
assert.equal(windowsWin.visible, true);
assert.ok(windowsWin.skipTaskbarCalls > beforeShow, 'show must reapply skipTaskbar');
windowsManager.setContentProtection(false);
assert.equal(windowsWin.skipTaskbar, false);
windowsManager.setContentProtection(true);
assert.equal(windowsWin.skipTaskbar, true);
windowsWin.emit('focus');
assert.equal(windowsWin.skipTaskbar, true);
console.log('PASS: Windows stealth keeps the overlay off the taskbar after show and focus');

const registrations = new Map();
const shortcuts = {
  register: (key, callback) => {
    if (key === 'Command+Shift+S') return false;
    if (key === 'Command+Shift+R') throw new Error('invalid accelerator');
    registrations.set(key, callback); return true;
  },
  unregister: key => registrations.delete(key)
};
const { HotkeyManager } = load('src/main/hotkey-manager.ts', { globalShortcut: shortcuts });
const hotkeys = new HotkeyManager();
hotkeys.registerHotkeys(mac); hotkeys.start();
assert.equal(hotkeys.getFailedShortcuts().join(','), 'captureScreen,toggleRecording');
assert.ok(registrations.has('Command+\\'));
assert.ok(!registrations.has('Escape'));
let fired; hotkeys.on('hotkey', action => { fired = action; });
registrations.get('Command+Enter')(); assert.equal(fired, 'chat');
hotkeys.stop(); assert.equal(registrations.size, 0);
console.log('PASS: accelerator registration, callback dispatch, conflicts surfaced, no global Escape, cleanup');

const winRegistrations = new Map();
const { HotkeyManager: WindowsHotkeyManager } = load('src/main/hotkey-manager.ts', {
  globalShortcut: {
    register: (key, callback) => { winRegistrations.set(key, callback); return true; },
    unregister: key => winRegistrations.delete(key)
  }
}, 'win32');
const windowsHotkeys = new WindowsHotkeyManager();
windowsHotkeys.registerHotkeys(defaultHotkeys('win32'));
windowsHotkeys.start();
assert.ok(winRegistrations.has('Control+Shift+H'));
assert.ok(winRegistrations.has('Control+Enter'));
assert.ok(winRegistrations.has('Control+Shift+X'));
assert.ok(winRegistrations.has('Control+Alt+Shift+Up'));
assert.equal(winRegistrations.has('Escape'), false);
assert.equal(winRegistrations.has('Control+Alt+Up'), false);
assert.equal([...winRegistrations.keys()].some(key => key.includes('Command') || key.includes('Option')), false);
windowsHotkeys.stop();
const reserved = defaultHotkeys('win32');
reserved.moveWindowUp = { vkCodes: [0x11, 0x12, 0x26], label: 'Ctrl+Alt+Up' };
reserved.cancelStream = { vkCodes: [0x1B], label: 'Escape' };
windowsHotkeys.registerHotkeys(reserved);
windowsHotkeys.start();
assert.ok(windowsHotkeys.getFailedShortcuts().includes('moveWindowUp'));
assert.ok(windowsHotkeys.getFailedShortcuts().includes('cancelStream'));
assert.equal(winRegistrations.has('Control+Alt+Up'), false);
assert.equal(winRegistrations.has('Escape'), false);
windowsHotkeys.stop();
console.log('PASS: Windows Ctrl/Alt accelerators, reserved chords refused, Escape stays local');

(async () => {
  manager.stealthShow();
  await manager.withoutOverlay(async () => { assert.equal(win.visible, false); });
  assert.equal(win.visible, true);
  await assert.rejects(manager.withoutOverlay(async () => { throw new Error('capture denied'); }), /capture denied/);
  assert.equal(win.visible, true, 'Failure must restore the overlay');
  await manager.withoutOverlay(async () => { manager.hide(); });
  assert.equal(win.visible, false, 'User Hide during capture wins over auto-restore');
  await manager.withoutOverlay(async () => {});
  assert.equal(win.visible, false, 'Already-hidden overlay stays hidden');
  console.log('PASS: own-capture exclusion, restore after failure, manual Hide and hidden state respected');
})().catch(error => { console.error(error); process.exitCode = 1; });
