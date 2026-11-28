import * as THREE from 'three';

/**
 * Generates a sharp, industrial stencil decal CanvasTexture for inner-face part markings
 * (`1-A`, `1-B`, `1-C`, `1-D`, `1-E`, `1-F`...). Rendered strictly on FrontSide facing
 * inward inside the duct so it never bleeds through to outer walls.
 */
export function createFaceLabelTexture(partCode: string, selected: boolean): THREE.CanvasTexture {
  const w = 512;
  const h = 236;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  // Clean high-contrast engineering marking pill on inner metal surface
  const pad = 16;
  const r = 28;
  const rw = w - pad * 2;
  const rh = h - pad * 2;

  ctx.beginPath();
  ctx.moveTo(pad + r, pad);
  ctx.lineTo(pad + rw - r, pad);
  ctx.quadraticCurveTo(pad + rw, pad, pad + rw, pad + r);
  ctx.lineTo(pad + rw, pad + rh - r);
  ctx.quadraticCurveTo(pad + rw, pad + rh, pad + rw - r, pad + rh);
  ctx.lineTo(pad + r, pad + rh);
  ctx.quadraticCurveTo(pad, pad + rh, pad, pad + rh - r);
  ctx.lineTo(pad, pad + r);
  ctx.quadraticCurveTo(pad, pad, pad + r, pad);
  ctx.closePath();

  if (selected) {
    ctx.fillStyle = 'rgba(14, 165, 233, 0.90)';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.98)';
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.80)';
    ctx.stroke();
  }

  // Crisp bold stencil part code (e.g. "1-A", "1-E")
  ctx.font = '700 132px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = selected ? '#ffffff' : '#f1f5f9';
  ctx.fillText(partCode, w / 2, h / 2 + 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}
