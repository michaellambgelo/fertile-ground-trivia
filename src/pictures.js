// Picture Round data + paste-buffer persistence.
//
// Workflow: user pastes images in the control window → we store as data URLs
// in localStorage as a temporary scratch buffer. A "Save All to Disk" button
// downloads them as picture-01.png ... picture-10.png so the user can drop
// them into public/images/ — at which point the static paths take over and
// localStorage can be cleared.

const COUNT = 10;
const STORAGE_KEY = 'pub-trivia-scaffold.pictures';

// Static defaults — point to the predictable on-disk paths the editor's
// "Save All to Disk" button writes to. If the file isn't there yet, the
// <img> 404s and the slide falls back to the placeholder.
export const DEFAULT_PICTURE_ITEMS = Array.from({ length: COUNT }, (_, i) => ({
  src: `${import.meta.env.BASE_URL}images/picture-${String(i + 1).padStart(2, '0')}.png`,
  caption: null,
}));

export const PICTURE_FILENAME = (i) =>
  `picture-${String(i + 1).padStart(2, '0')}.png`;

// Picture-round cell geometry — single source of truth shared by the display
// slide (slides.jsx), the canvas handout (handout.js), and the editor preview
// (ControlApp.jsx) so all three crop/letterbox identically. Keys are the
// `meta.pictureRound.aspect` values; `label` is shown in the editor picker.
export const PICTURE_ASPECTS = {
  '316 / 220': { w: 316, h: 220, label: 'Landscape (default)' },
  '3 / 2': { w: 3, h: 2, label: 'Flag 3:2' },
  '2 / 1': { w: 2, h: 1, label: 'Banner 2:1' },
  '1 / 1': { w: 1, h: 1, label: 'Square 1:1' },
};
export const DEFAULT_ASPECT = '316 / 220';
export const PICTURE_FITS = ['cover', 'contain'];

// Resolve a `meta.pictureRound.aspect` string to a CSS value + numeric pair.
// Unknown/garbage values degrade to the default (never yields `undefined`,
// which would collapse the cells).
export function resolveAspect(aspect) {
  const a = PICTURE_ASPECTS[aspect] || PICTURE_ASPECTS[DEFAULT_ASPECT];
  return { css: `${a.w} / ${a.h}`, w: a.w, h: a.h };
}

// Size the picture grid honoring BOTH the horizontal (cols across contentW) and
// vertical (rows within availH) constraints, so tall aspects (e.g. square)
// shrink and center instead of overflowing the 2-row grid. `cellExtra` is the
// per-row non-photo height (handout's answer area + gap); the on-screen slide
// passes 0. Returns the photo cell width/height and the actual grid width
// (< contentW when vertically constrained → caller centers it).
export function pictureGridLayout({ aspect, cols, rows, contentW, availH, gap, cellExtra = 0 }) {
  const { w, h } = resolveAspect(aspect);
  const cellWByCols = (contentW - gap * (cols - 1)) / cols;
  const photoHMax = (availH - gap * (rows - 1)) / rows - cellExtra;
  const cellWByRows = photoHMax > 0 ? photoHMax * (w / h) : cellWByCols;
  const cellW = Math.min(cellWByCols, cellWByRows);
  const photoH = cellW * (h / w);
  const gridW = cellW * cols + gap * (cols - 1);
  return { cellW, photoH, gridW };
}

// Default crop position: 50/50 = centered (matches `object-position: center`).
export const DEFAULT_POSITION = { x: 50, y: 50 };

// Normalize a paste entry to the current shape, defaulting any missing fields.
// Older localStorage entries (pre-crop) won't have `position`.
function normalizePaste(p) {
  if (!p || typeof p !== 'object') return { dataUrl: null, caption: null, position: { ...DEFAULT_POSITION } };
  return {
    dataUrl: p.dataUrl ?? null,
    caption: p.caption ?? null,
    position: {
      x: p.position?.x ?? 50,
      y: p.position?.y ?? 50,
    },
  };
}

// Returns 10 entries: { dataUrl, caption, position: {x, y} }
export function loadPastes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === COUNT) {
        return parsed.map(normalizePaste);
      }
    }
  } catch {
    // fall through
  }
  return Array.from({ length: COUNT }, () => normalizePaste(null));
}

export function savePastes(pastes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pastes));
}

export function clearPastes() {
  localStorage.removeItem(STORAGE_KEY);
}

// Resolve what to actually render: pasted data URL wins over the disk path,
// pasted caption (rare) wins over the default caption, position falls back
// to centered when nothing has been adjusted.
export function mergeItems(pastes) {
  return DEFAULT_PICTURE_ITEMS.map((item, i) => {
    const p = pastes[i] || {};
    return {
      src: p.dataUrl || item.src,
      caption: p.caption || item.caption,
      position: {
        x: p.position?.x ?? 50,
        y: p.position?.y ?? 50,
      },
      isPasted: !!p.dataUrl,
    };
  });
}
