import { desktopCapturer, screen } from 'electron';
import { ensureScreenPermission, getScreenPermissionStatus, ScreenPermissionError } from './screen-permission';
import { visionJpeg, visionPixelSize } from '../ai/vision-image';

export interface CapturedScreen {
  imageDataUrl: string;
  ocrDataUrl: string;
  width: number;
  height: number;
  timestamp: number;
  displayId: string;
}

export function listDisplays() {
  return screen.getAllDisplays().map((display, index) => ({
    id: String(display.id),
    label: display.label || 'Display ' + (index + 1) + ' (' + display.size.width + ' × ' + display.size.height + ')'
  }));
}

export async function captureScreen(displayId = 'cursor', options: { allowPermissionPrompt?: boolean } = {}): Promise<CapturedScreen> {
  const display = displayId === 'cursor'
    ? screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    : screen.getAllDisplays().find(item => String(item.id) === displayId);
  if (!display) throw new Error('The selected display is disconnected. Choose a display in Settings.');
  await ensureScreenPermission(options.allowPermissionPrompt ?? true);
  const thumbnailSize = visionPixelSize(
    display.size.width * display.scaleFactor,
    display.size.height * display.scaleFactor
  );
  let sources;
  try {
    sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize
    });
  } catch (error) {
    const status = getScreenPermissionStatus();
    if (status === 'needs-approval' || status === 'restricted') throw new ScreenPermissionError(status === 'restricted');
    throw error;
  }
  // Fail closed if permission was revoked while capture was in flight.
  await ensureScreenPermission(false);
  const source = sources.find(item => item.display_id === String(display.id));
  if (!source || source.thumbnail.isEmpty()) {
    throw new Error('No screen image is available. Check Screen & System Audio Recording permission and restart the app.');
  }
  const thumbnail = source.thumbnail;
  const size = thumbnail.getSize();
  const ocrLongEdge = Math.max(size.width, size.height);
  const ocrImage = ocrLongEdge > 1600
    ? thumbnail.resize(visionPixelSize(size.width, size.height, 1600))
    : thumbnail;
  return {
    imageDataUrl: 'data:image/jpeg;base64,' + visionJpeg(thumbnail).toString('base64'),
    ocrDataUrl: 'data:image/png;base64,' + ocrImage.toPNG().toString('base64'),
    width: size.width, height: size.height, timestamp: Date.now(), displayId: String(display.id)
  };
}
