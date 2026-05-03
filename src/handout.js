// Render the picture round as a print-friendly PNG (light background, dark
// borders, no atmosphere overlays, no "Recap" eyebrow). Handles copy-to-
// clipboard, file download, and per-image download for the "save to disk"
// workflow.
//
// Drawn directly on a 2D canvas — no html2canvas dependency, no DOM clones.

import { PICTURE_FILENAME } from './pictures.js';

// Page geometry — mirrors the on-screen PictureRoundRecap slide so the same
// image crops the same way in both surfaces. Margins, gaps, and cell
// dimensions match the deck's SPACING + TYPE_SCALE constants.
const W = 1920;
const H = 1080;
const MARGIN_X = 120;                            // matches slide paddingX
const TITLE_Y = 100;                             // matches slide paddingTop
const TITLE_HEIGHT = 96;
const RULE_Y = TITLE_Y + TITLE_HEIGHT + 14;      // 210
const INSTRUCTION_Y = RULE_Y + 32;               // 242
const GRID_TOP = INSTRUCTION_Y + 80;             // 322
const GRID_BOTTOM = H - 90;                      // 990 — matches slide paddingBottom
const GAP = 24;                                  // matches slide grid gap
const COLS = 5;
const ROWS = 2;
// Each cell is split into a photo box (top) and an answer area (bottom),
// matching the slide's PictureRecapCell flex column.
const ANSWER_HEIGHT = 56;                        // matches slide answer-line area
const PHOTO_GAP = 14;                            // matches slide gap between photo and answer
const ANSWER_LINE_THICKNESS = 2;

// Wait for fonts so the canvas uses Oswald, not the system fallback.
async function ensureFonts() {
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';  // best-effort; data URLs and same-origin work regardless
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function renderHandoutCanvas(items) {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // White background — print-friendly, ink-friendly.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Title — "PICTURE ROUND" in deck typography
  ctx.fillStyle = '#0B0E1A';
  ctx.font = `700 88px 'Oswald', 'Bebas Neue', Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('PICTURE ROUND', W / 2, TITLE_Y);

  // Thin accent rule under the title
  const ruleW = 220;
  ctx.fillStyle = '#0B0E1A';
  ctx.fillRect((W - ruleW) / 2, RULE_Y, ruleW, 3);

  // Instruction line — what contestants are doing. Left-aligned to match the
  // slide layout (italic Inter body text under the accent rule).
  ctx.fillStyle = '#54514A';
  ctx.font = `italic 500 36px 'Inter', system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Identify the character or creature.', MARGIN_X, INSTRUCTION_Y);

  // Cell geometry — each row is split into a photo box (most of the height)
  // and an answer area below (writing space with a rule at the bottom).
  const gridW = W - MARGIN_X * 2;
  const gridH = GRID_BOTTOM - GRID_TOP;
  const cellW = (gridW - GAP * (COLS - 1)) / COLS;
  const rowH = (gridH - GAP * (ROWS - 1)) / ROWS;
  const photoH = rowH - ANSWER_HEIGHT - PHOTO_GAP;

  // Pre-load every image (parallel)
  const images = await Promise.all(items.map((it) => loadImage(it.src)));

  for (let i = 0; i < items.length; i++) {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const x = MARGIN_X + c * (cellW + GAP);
    const y = GRID_TOP + r * (rowH + GAP);

    // Photo box background (faint) for empty cells; transparent if image present
    if (!images[i]) {
      ctx.fillStyle = '#F5F2EA';
      ctx.fillRect(x, y, cellW, photoH);
    }

    // Photo box border
    ctx.strokeStyle = '#0B0E1A';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, cellW - 2, photoH - 2);

    // Image (object-fit: cover) inside the photo box, with crop position
    // honored — same math object-position uses in the DOM: position.x/y are
    // 0-100 and select which slice of the over-sized scaled image lands in
    // the cell.
    if (images[i]) {
      const img = images[i];
      const ratio = Math.max(cellW / img.width, photoH / img.height);
      const dW = img.width * ratio;
      const dH = img.height * ratio;
      const px = (items[i].position?.x ?? 50) / 100;
      const py = (items[i].position?.y ?? 50) / 100;
      const dX = x + (cellW - dW) * px;
      const dY = y + (photoH - dH) * py;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 2, y + 2, cellW - 4, photoH - 4);
      ctx.clip();
      ctx.drawImage(img, dX, dY, dW, dH);
      ctx.restore();
    } else {
      // "PHOTO" label centered when empty
      ctx.fillStyle = '#A8A39A';
      ctx.font = `500 28px 'Oswald', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PHOTO', x + cellW / 2, y + photoH / 2);
    }

    // Number badge (top-left of the photo box, dark on white for ink-friendly contrast)
    const badgeSize = 56;
    const bx = x + 12;
    const by = y + 12;
    ctx.fillStyle = '#0B0E1A';
    ctx.fillRect(bx, by, badgeSize, badgeSize);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 30px 'Oswald', 'Bebas Neue', Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1).padStart(2, '0'), bx + badgeSize / 2, by + badgeSize / 2 + 1);

    // Answer line — sits at the bottom of the answer area; writing goes above it.
    const lineY = y + photoH + PHOTO_GAP + ANSWER_HEIGHT - ANSWER_LINE_THICKNESS;
    ctx.fillStyle = '#0B0E1A';
    ctx.fillRect(x, lineY, cellW, ANSWER_LINE_THICKNESS);
  }

  return canvas;
}

function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((resolve) => canvas.toBlob(resolve, type));
}

export async function copyHandoutToClipboard(items) {
  const canvas = await renderHandoutCanvas(items);
  const blob = await canvasToBlob(canvas);
  if (!blob) throw new Error('Failed to create handout blob');
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Clipboard image API not supported in this browser');
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export async function downloadHandoutPng(items, filename = 'picture-round-handout.png') {
  const canvas = await renderHandoutCanvas(items);
  const blob = await canvasToBlob(canvas);
  if (!blob) throw new Error('Failed to create handout blob');
  triggerDownload(blob, filename);
}

// Download each pasted image individually with the predictable picture-NN.png
// names so the user can drop them into public/images/. Skips empty cells.
// Returns the count of files downloaded.
export async function downloadAllImages(items) {
  let count = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.src) continue;
    const blob = await fetchAsBlob(item.src);
    if (!blob) continue;
    triggerDownload(blob, PICTURE_FILENAME(i));
    count++;
    // tiny gap so browsers don't suppress repeated downloads
    await new Promise((r) => setTimeout(r, 80));
  }
  return count;
}

async function fetchAsBlob(src) {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
