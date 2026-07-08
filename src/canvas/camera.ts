/**
 * Damped map camera for the transit view. World space = flight-map layout
 * coordinates (viewport pixels at zoom 1). The camera eases toward its
 * targets every frame — nothing snaps. By default it follows the ship when
 * zoomed in; panning breaks follow until the user recenters.
 */

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
const STORE_KEY = 'driftless-camera-v1';

type Camera = {
  zoom: number;
  targetZoom: number;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  follow: boolean;
  initialized: boolean;
};

const cam: Camera = {
  zoom: 1,
  targetZoom: 1,
  cx: 0,
  cy: 0,
  tx: 0,
  ty: 0,
  follow: true,
  initialized: false,
};

let lastSave = 0;

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function getCamera(): Readonly<Camera> {
  return cam;
}

export function isZoomedIn(): boolean {
  return cam.targetZoom > 1.05;
}

/** Multiply the zoom target. When not following, keeps the world point under (sx, sy) fixed. */
export function zoomBy(factor: number, sx?: number, sy?: number, w?: number, h?: number) {
  const prev = cam.targetZoom;
  cam.targetZoom = clampZoom(cam.targetZoom * factor);
  if (!cam.follow && sx !== undefined && sy !== undefined && w && h && cam.targetZoom !== prev) {
    // pivot zoom: world point under the pointer stays put
    const wx = cam.tx + (sx - w / 2) / prev;
    const wy = cam.ty + (sy - h / 2) / prev;
    cam.tx = wx - (sx - w / 2) / cam.targetZoom;
    cam.ty = wy - (sy - h / 2) / cam.targetZoom;
  }
}

/** Screen-space drag. Breaks follow. */
export function panBy(dxScreen: number, dyScreen: number) {
  if (cam.targetZoom <= 1.02) return;
  cam.follow = false;
  cam.tx -= dxScreen / cam.zoom;
  cam.ty -= dyScreen / cam.zoom;
}

export function recenter() {
  cam.follow = true;
}

/** Ease back to the full overview (used during arrival). */
export function zoomHome() {
  cam.targetZoom = 1;
}

export function resetCamera(clearStorage = false) {
  cam.targetZoom = 1;
  cam.follow = true;
  cam.initialized = false;
  if (clearStorage) {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch { /* private mode */ }
  }
}

/** Restore a persisted camera once per mission (reload of an in-progress session). */
export function ensureCameraLoaded() {
  if (cam.initialized) return;
  cam.initialized = true;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { z?: number; follow?: boolean; tx?: number; ty?: number };
    cam.targetZoom = clampZoom(saved.z ?? 1);
    cam.follow = saved.follow ?? true;
    if (saved.tx !== undefined) cam.tx = saved.tx;
    if (saved.ty !== undefined) cam.ty = saved.ty;
  } catch { /* ignore corrupt state */ }
}

/**
 * Advance the easing. `shipX/Y` in world coords; bounds clamp the look-at
 * point so the user can never wander into empty space.
 */
export function stepCamera(
  dt: number,
  shipX: number,
  shipY: number,
  w: number,
  h: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
) {
  if (cam.targetZoom <= 1.02) {
    // overview: look at the viewport centre
    cam.tx = w / 2;
    cam.ty = h / 2;
    cam.follow = true;
  } else if (cam.follow) {
    cam.tx = shipX;
    cam.ty = shipY;
  }
  cam.tx = Math.min(bounds.maxX, Math.max(bounds.minX, cam.tx));
  cam.ty = Math.min(bounds.maxY, Math.max(bounds.minY, cam.ty));

  const kz = Math.min(1, dt * 5);
  const kp = Math.min(1, dt * 4);
  cam.zoom += (cam.targetZoom - cam.zoom) * kz;
  cam.cx += (cam.tx - cam.cx) * kp;
  cam.cy += (cam.ty - cam.cy) * kp;

  // persist (throttled) so a mid-session reload restores the view
  const now = performance.now();
  if (now - lastSave > 800) {
    lastSave = now;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ z: cam.targetZoom, follow: cam.follow, tx: cam.tx, ty: cam.ty }));
    } catch { /* ignore */ }
  }
}

export function applyCamera(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.translate(w / 2, h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.cx, -cam.cy);
}

export function worldToScreen(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return { x: (x - cam.cx) * cam.zoom + w / 2, y: (y - cam.cy) * cam.zoom + h / 2 };
}
