import { Tray, Menu, nativeImage, app } from 'electron';

export class TrayManager {
  private tray: Tray | null = null;

  create(callbacks: {
    onToggleOverlay: () => void;
    onToggleRecording: () => void;
    onSettings: () => void;
    onQuit: () => void;
    accelerators?: {
      toggleOverlay?: string | null;
      toggleRecording?: string | null;
      quit?: string | null;
    };
  }): Tray {
    // Real monochrome bitmap: an empty NativeImage creates an invisible macOS tray.
    const pixels = Buffer.alloc(18 * 18 * 4);
    for (let y = 3; y < 16; y++) {
      for (let x = 2; x < 16; x++) {
        const border = y <= 4 || (y <= 12 && (x <= 3 || x >= 14)) || y === 11 || y === 12;
        const tail = y >= 13 && x >= 4 && x <= 6;
        const dots = y >= 7 && y <= 8 && [6, 9, 12].includes(x);
        if (border && y <= 12 || tail || dots) pixels[(y * 18 + x) * 4 + 3] = 255;
      }
    }
    const icon = nativeImage.createFromBitmap(pixels, { width: 18, height: 18 });
    if (process.platform === 'darwin') icon.setTemplateImage(true);

    this.tray = new Tray(icon);
    this.tray.setToolTip('Interview Overlay');

    // macOS menu items stay unlabeled. Windows shows Ctrl/Alt accelerators.
    const item = (label: string, click: () => void, accelerator?: string | null) => (
      process.platform === 'darwin' || !accelerator ? { label, click } : { label, click, accelerator }
    );
    const contextMenu = Menu.buildFromTemplate([
      item('Toggle Overlay', callbacks.onToggleOverlay, callbacks.accelerators?.toggleOverlay),
      item('Toggle Recording', callbacks.onToggleRecording, callbacks.accelerators?.toggleRecording),
      { type: 'separator' },
      {
        label: 'Settings',
        click: callbacks.onSettings
      },
      { type: 'separator' },
      item('Quit', () => {
        callbacks.onQuit();
        app.quit();
      }, callbacks.accelerators?.quit)
    ]);

    this.tray.setContextMenu(contextMenu);

    if (process.platform !== 'darwin') this.tray.on('click', callbacks.onToggleOverlay);

    return this.tray;
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  setRecordingState(isRecording: boolean): void {
    this.tray?.setToolTip(
      isRecording ? 'Interview Overlay (Recording)' : 'Interview Overlay'
    );
  }
}
