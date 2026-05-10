// Picture Round data + paste-buffer persistence.
//
// Workflow: user pastes images in the control window → we store as data URLs
// in localStorage as a temporary scratch buffer. A "Save All to Disk" button
// downloads them as picture-01.png ... picture-10.png so the user can drop
// them into public/images/ — at which point the static paths take over and
// localStorage can be cleared.

const COUNT = 10;
const STORAGE_KEY = 'trivia-scaffold.pictures';

// Static defaults — point to the predictable on-disk paths the editor's
// "Save All to Disk" button writes to. If the file isn't there yet, the
// <img> 404s and the slide falls back to the placeholder.
export const DEFAULT_PICTURE_ITEMS = Array.from({ length: COUNT }, (_, i) => ({
  src: `${import.meta.env.BASE_URL}images/picture-${String(i + 1).padStart(2, '0')}.png`,
  caption: null,
}));

export const PICTURE_FILENAME = (i) =>
  `picture-${String(i + 1).padStart(2, '0')}.png`;

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
