# Interview Overlay

Invisible AI-powered interview assistant overlay. The macOS app and the Windows app are built separately. Neither command packages the other platform.

The shared JavaScript bundle is `npm run build` (`electron-vite build`). Each platform command runs that first, then adds its own native helper and installer.

English OCR data is not in git. Both packagers expect `eng.traineddata` in the project root (it is copied to `ocr/eng.traineddata` inside the app). Download it from the [Tesseract `tessdata` repository](https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata).

```bash
npm install
```

`npm install` compiles the Windows native addon only on Windows, and only for the system Node. The Windows package command rebuilds that addon for Electron. On macOS and Linux the native install step is skipped.

## macOS

Run this on a Mac with Apple Silicon, macOS 13 or later, and Xcode command-line tools:

```bash
npm run package:mac
```

That builds the Swift audio helper, the Electron bundle, an ad-hoc signed `.app`, then:

- `release/mac-arm64/InterviewOverlay.app`
- `release/InterviewOverlay-<version>-arm64.dmg`
- `release/InterviewOverlay-<version>-arm64-mac.zip`

`npm run package:mac` refuses to run on any other OS. These local packages are ad-hoc signed, not notarized. Developer ID signing and notarization are done separately on a Mac.

`npm run build:mac-audio` rebuilds only the `build/mac/overlay-audio` helper. `npm run dev` starts the unpackaged app.

Microphone, system audio, and the menu-bar controls are described in [docs/mac-controls.md](docs/mac-controls.md).

## Windows

The Windows installer is an NSIS x64 package. The native addon (WASAPI loopback and microphone capture, raw-input hotkeys, and window capture exclusion) compiles only on Windows with MSVC.

On a Windows x64 machine, install:

- Node.js 20 or 22
- Python 3 (used by node-gyp)
- Visual Studio 2022 Build Tools with the **Desktop development with C++** workload (MSVC and the Windows SDK)

Put `eng.traineddata` in the project root, then:

```bash
npm run build:win
```

That runs, in order:

1. `npm run build`
2. `npm run build:win-native` — `node-gyp` against the installed Electron version, x64, writing `build/Release/native_addon.node`
3. `electron-builder --win --x64`

The installer is:

- `release/InterviewOverlay-<version>-win-x64.exe`

Windows shortcuts use Ctrl and Alt. They are not the macOS symbols. Bare Escape stays inside the chat field and Settings (it is not a global hotkey). Ctrl+Alt+Arrow is not used, because Windows and many graphics drivers reserve it for rotating the display.

| Action | Windows |
| --- | --- |
| Show / hide overlay | Ctrl+Shift+H |
| Open chat / send question | Ctrl+Enter |
| Get answer from screen | Ctrl+Shift+A |
| Capture screen | Ctrl+Shift+S |
| Toggle recording | Ctrl+Shift+R |
| Toggle click-through | Ctrl+Shift+I |
| Stop answer | Ctrl+Shift+X |
| New conversation | Ctrl+Shift+N |
| Scroll up / down | Ctrl+Shift+Up / Down |
| Quit | Ctrl+Shift+Q |
| Move overlay | Ctrl+Alt+Shift+Arrow |
| Show / hide (alternate) | Ctrl+H |
| Toggle typing focus | Ctrl+Shift+W |
| Exit chat / stop answer while typing; close Settings | Escape (local only) |

The tray menu shows the overlay, recording, and quit accelerators. macOS bindings are unchanged; see [docs/mac-controls.md](docs/mac-controls.md).

It is per-user by default (the install directory can be changed) and creates Desktop and Start menu shortcuts. The app icon is `assets/icons/app-icon.ico`.

`npm run build:win-native` rebuilds only the addon. `npm run package` is still `electron-builder --win` alone: it does not compile the bundle or the addon. Use `npm run build:win`.

### Signing, and what to check on Windows

The packager does not select a certificate unless you ask it to. An unsigned installer is enough for a local test; SmartScreen will warn.

To sign on Windows, either:

- set `CSC_LINK` to a `.pfx` path and `CSC_KEY_PASSWORD` to its password, then rerun `npm run build:win`, or
- set `CSC_IDENTITY_AUTO_DISCOVERY=true` to use a certificate already in the Windows certificate store

Authenticode signing and SmartScreen reputation are done on Windows. This repo does not notarize Windows builds.

After installing the Windows-built package, check on that machine:

- the overlay opens, the tray icon toggles it, and the default Ctrl shortcuts match Settings
- recording prompts for the microphone and system-audio (WASAPI loopback) follows the Settings checkboxes
- capture protection against the screen-share app you actually use (exclusion is requested, not guaranteed for every recorder)
- the app without `native_addon.node` still opens, but WASAPI, raw-input hotkeys, and native window helpers are absent and Electron shortcuts are used instead

### Download an installer

Pushes to `cursor/windows-build-348f`, and a manual run, start the **Windows installer** GitHub Actions workflow (`.github/workflows/windows-installer.yml`) on `windows-latest`. That job compiles `native_addon.node` and uploads one artifact:

- Artifact name: `InterviewOverlay-win-x64`
- File inside the downloaded zip: `InterviewOverlay-<version>-win-x64.exe`

Open the repository **Actions** tab, select **Windows installer**, open the run, and download **InterviewOverlay-win-x64** from the Artifacts section. You can also run the workflow yourself with **Run workflow**.

A Linux cross-build of the same NSIS installer is attached with this change as `InterviewOverlay-1.2.0-win-x64.exe`. That file installs and launches the app. It omits `native_addon.node`, so WASAPI capture, raw-input hotkeys, and the native window helpers are absent until you install a build produced on Windows.

### Cross-building the installer

`npm run build:win` can package the NSIS installer on Linux or macOS when Wine is installed, including 32-bit Wine. electron-builder uses Wine for the executable icon and to capture the uninstaller. That installer still omits `native_addon.node`. Ship the installer produced on Windows when you need WASAPI, raw-input hotkeys, and the native window helpers. On Windows, the same command does not use Wine.

## Checks

```bash
npx tsc -p tsconfig.node.json --noEmit
npx tsc -p tsconfig.web.json --noEmit
npm run test:controls
npm run test:media
npm run test:groq
npm run test:anthropic
npm run test:prompt
npm run test:permissions
npm run build
```
