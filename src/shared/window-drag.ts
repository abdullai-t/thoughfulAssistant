/** Interactive and scrolling surfaces. Dragging starts on the overlay chrome around them. */
export const WINDOW_NO_DRAG = [
  'button', 'a', 'input', 'textarea', 'select', 'option', 'label', 'summary', 'meter',
  '[role="button"]', '[role="tab"]', '[role="slider"]', '[contenteditable="true"]',
  '.window-no-drag', '.tab-content', '.screenshot-thumbnails', '.audio-panel',
  '.overlay-header-controls', '.chat-controls', '.settings-footer'
].join(', ');

export function isWindowDragTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object' || !('closest' in target)) return false;
  const closest = (target as { closest?: unknown }).closest;
  if (typeof closest !== 'function') return false;
  const node = target as { closest: (selector: string) => unknown };
  if (node.closest(WINDOW_NO_DRAG)) return false;
  return !!node.closest('.overlay-panel, .settings-topbar');
}
