import type {
  Dimension2D,
  FlatPatternDocument,
  Point2D,
  ZoneFillKind,
} from '../types/flatPattern2d';

export function pointsToPath(pts: readonly Point2D[]): string {
  if (pts.length === 0) return '';
  return `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getZoneFillStyle(kind: ZoneFillKind, forPrint: boolean): string {
  if (forPrint) {
    switch (kind) {
      case 'female_seam':
        return 'rgba(220, 38, 38, 0.16)';
      case 'male_seam':
        return 'rgba(37, 99, 235, 0.16)';
      case 'weld_seam':
        return 'rgba(217, 119, 6, 0.18)';
      case 'flange':
        return 'rgba(202, 138, 4, 0.14)';
      case 'plain_ext':
        return 'rgba(14, 165, 233, 0.12)';
    }
  }
  switch (kind) {
    case 'female_seam':
      return 'rgba(225, 63, 63, 0.24)';
    case 'male_seam':
      return 'rgba(47, 124, 246, 0.24)';
    case 'weld_seam':
      return 'rgba(245, 158, 11, 0.24)';
    case 'flange':
      return 'rgba(234, 179, 8, 0.16)';
    case 'plain_ext':
      return 'rgba(56, 189, 248, 0.14)';
  }
}

export function getDimColor(accent: Dimension2D['accent'], forPrint: boolean): string {
  if (forPrint) {
    switch (accent) {
      case 'sky':
        return '#0369a1';
      case 'amber':
        return '#b45309';
      case 'red':
        return '#b91c1c';
      case 'blue':
        return '#1d4ed8';
      default:
        return '#334155';
    }
  }
  switch (accent) {
    case 'sky':
      return '#7dd3fc';
    case 'amber':
      return '#fbbf24';
    case 'red':
      return '#f87171';
    case 'blue':
      return '#60a5fa';
    default:
      return '#94a3b8';
  }
}

/**
 * Generates a standalone print/Laser-ready SVG document (1:1 mm units, white paper, crisp dark ink).
 */
export function buildExportableSvgString(
  doc: FlatPatternDocument,
  technicalMode: boolean
): string {
  const titleBarH = 145;
  const pad = 60;
  const totalW = Math.ceil(doc.bounds.width + pad * 2);
  const totalH = Math.ceil(doc.bounds.height + titleBarH + pad * 2);

  const piecesSvg = doc.pieces
    .map((p) => {
      const cutD = pointsToPath(p.cutPolygon);
      const zones = technicalMode
        ? p.zoneFills
            .map(
              (z) =>
                `<path d="${pointsToPath(z.points)}" fill="${getZoneFillStyle(z.kind, true)}" stroke="none" />`
            )
            .join('\n')
        : '';

      const folds = p.foldLines
        .map(
          (l) =>
            `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#64748b" stroke-width="1.4" stroke-dasharray="10 6" />`
        )
        .join('\n');

      const bends = p.bendLines
        .map(
          (l) =>
            `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#15803d" stroke-width="1.8" stroke-dasharray="16 8" />`
        )
        .join('\n');

      const ribs = p.ribLines
        .map(
          (l) =>
            `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#0284c7" stroke-width="1.2" />`
        )
        .join('\n');

      const wallLbls = p.wallLabels
        .map(
          (wl) =>
            `<text x="${wl.x}" y="${wl.y}" text-anchor="middle" fill="#64748b" font-family="ui-monospace, monospace" font-size="22" font-weight="600">${escapeXml(wl.text)}${wl.subtext ? ` (${escapeXml(wl.subtext)})` : ''}</text>`
        )
        .join('\n');

      const dims = p.dimensions
        .map((d) => {
          const col = getDimColor(d.accent, true);
          const fs = d.tier === 'total' ? 28 : 21;
          const fw = d.tier === 'total' ? '700' : '600';
          const tick = 8;
          if (d.axis === 'horizontal') {
            const yDim = d.anchor + d.offset;
            const yExtEnd = yDim + (d.offset < 0 ? -12 : 12);
            const midX = (d.start + d.end) * 0.5;
            return `
              <g stroke="${col}" stroke-width="1.3">
                <line x1="${d.start}" y1="${d.anchor}" x2="${d.start}" y2="${yExtEnd}" stroke-opacity="0.55" />
                <line x1="${d.end}" y1="${d.anchor}" x2="${d.end}" y2="${yExtEnd}" stroke-opacity="0.55" />
                <line x1="${d.start}" y1="${yDim}" x2="${d.end}" y2="${yDim}" />
                <line x1="${d.start - tick}" y1="${yDim + tick}" x2="${d.start + tick}" y2="${yDim - tick}" />
                <line x1="${d.end - tick}" y1="${yDim + tick}" x2="${d.end + tick}" y2="${yDim - tick}" />
              </g>
              <text x="${midX}" y="${yDim - 8}" text-anchor="middle" fill="${col}" font-family="ui-monospace, monospace" font-size="${fs}" font-weight="${fw}">${escapeXml(d.label)}</text>`;
          } else {
            const xDim = d.anchor + d.offset;
            const xExtEnd = xDim + (d.offset < 0 ? -12 : 12);
            const midY = (d.start + d.end) * 0.5;
            return `
              <g stroke="${col}" stroke-width="1.3">
                <line x1="${d.anchor}" y1="${d.start}" x2="${xExtEnd}" y2="${d.start}" stroke-opacity="0.55" />
                <line x1="${d.anchor}" y1="${d.end}" x2="${xExtEnd}" y2="${d.end}" stroke-opacity="0.55" />
                <line x1="${xDim}" y1="${d.start}" x2="${xDim}" y2="${d.end}" />
                <line x1="${xDim - tick}" y1="${d.start + tick}" x2="${xDim + tick}" y2="${d.start - tick}" />
                <line x1="${xDim - tick}" y1="${d.end + tick}" x2="${xDim + tick}" y2="${d.end - tick}" />
              </g>
              <text x="${xDim - 10}" y="${midY}" text-anchor="middle" transform="rotate(-90 ${xDim - 10} ${midY})" fill="${col}" font-family="ui-monospace, monospace" font-size="${fs}" font-weight="${fw}">${escapeXml(d.label)}</text>`;
          }
        })
        .join('\n');

      const callouts = p.callouts
        .map(
          (c) =>
            `<text x="${c.x}" y="${c.y}" text-anchor="${c.align ?? 'middle'}" fill="${c.tone === 'amber' ? '#b45309' : '#475569'}" font-family="system-ui, sans-serif" font-size="22" font-weight="600">${escapeXml(c.text)}</text>`
        )
        .join('\n');

      const isRotatedOk = p.limitCheck.orientation === 'doc_6000';
      const isOverflow = p.limitCheck.orientation === 'vuot_kho';
      const collidesRightNeighbor = doc.pieces.some(
        (other) =>
          other.id !== p.id &&
          Math.abs(other.originY - p.originY) < 400 &&
          other.originX > p.originX &&
          p.originX + doc.sheetWidthMm >= other.originX - 180
      );
      let sheetGuide = '';
      if (isOverflow) {
        sheetGuide = `<line x1="-25" y1="${doc.sheetWidthMm}" x2="${p.widthMm + 25}" y2="${doc.sheetWidthMm}" stroke="#dc2626" stroke-width="2" stroke-dasharray="18 8" />
           <text x="${p.widthMm + 30}" y="${doc.sheetWidthMm + 7}" fill="#dc2626" font-family="ui-monospace, monospace" font-size="22" font-weight="700">Khổ ${doc.sheetWidthMm}</text>`;
      } else if (isRotatedOk && !collidesRightNeighbor && doc.sheetWidthMm - p.widthMm <= 420) {
        sheetGuide = `<line x1="${doc.sheetWidthMm}" y1="-25" x2="${doc.sheetWidthMm}" y2="${p.heightMm + 25}" stroke="#059669" stroke-width="2" stroke-dasharray="18 8" />
           <text x="${doc.sheetWidthMm + 12}" y="28" fill="#059669" font-family="ui-monospace, monospace" font-size="20" font-weight="700">Khổ ${doc.sheetWidthMm} (Xoay dọc)</text>`;
      } else if (!isRotatedOk && !p.isEndCap && doc.sheetWidthMm - p.heightMm <= 260) {
        sheetGuide = `<line x1="-25" y1="${doc.sheetWidthMm}" x2="${p.widthMm + 25}" y2="${doc.sheetWidthMm}" stroke="#059669" stroke-width="2" stroke-dasharray="18 8" />
           <text x="${p.widthMm + 30}" y="${doc.sheetWidthMm + 7}" fill="#059669" font-family="ui-monospace, monospace" font-size="22" font-weight="700">Khổ ${doc.sheetWidthMm}</text>`;
      }

      const warnBox =
        p.limitCheck.severity !== 'ok'
          ? `<rect x="-14" y="-14" width="${p.widthMm + 28}" height="${p.heightMm + 28}" fill="none" stroke="${p.limitCheck.severity === 'danger' ? '#dc2626' : '#d97706'}" stroke-width="3" stroke-dasharray="20 10" />
             <text x="${p.widthMm * 0.5}" y="-190" text-anchor="middle" fill="${p.limitCheck.severity === 'danger' ? '#dc2626' : '#b45309'}" font-family="system-ui, sans-serif" font-size="24" font-weight="700">⚠ ${escapeXml(p.limitCheck.statusText)}</text>`
          : '';

      return `
        <g transform="translate(${p.originX + pad}, ${p.originY + titleBarH + pad})">
          ${warnBox}
          <path d="${cutD}" fill="#f8fafc" stroke="none" />
          ${zones}
          ${folds}
          ${bends}
          ${ribs}
          <path d="${cutD}" fill="none" stroke="#0f172a" stroke-width="2.6" stroke-linejoin="miter" />
          ${sheetGuide}
          ${wallLbls}
          <g transform="translate(${p.centerLabelPos.x}, ${p.centerLabelPos.y})">
            <rect x="-72" y="-34" width="144" height="58" rx="8" fill="#ffffff" fill-opacity="0.92" stroke="#0f172a" stroke-width="2" />
            <text x="0" y="5" text-anchor="middle" fill="#0f172a" font-family="ui-monospace, monospace" font-size="38" font-weight="800">${escapeXml(p.partCode)}</text>
            <text x="0" y="48" text-anchor="middle" fill="#334155" font-family="system-ui, sans-serif" font-size="20" font-weight="600">${escapeXml(p.viewingFaceNote)}</text>
            <text x="0" y="74" text-anchor="middle" fill="#64748b" font-family="ui-monospace, monospace" font-size="18">${escapeXml(p.subtitle)}</text>
          </g>
          ${dims}
          ${callouts}
        </g>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}mm" height="${totalH}mm" viewBox="0 0 ${totalW} ${totalH}">
  <rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#ffffff" />
  <g transform="translate(${pad}, 32)">
    <rect x="0" y="0" width="${totalW - pad * 2}" height="96" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2" />
    <text x="24" y="40" fill="#0f172a" font-family="system-ui, sans-serif" font-size="30" font-weight="800">EUSTEEL DUCT3D — ${escapeXml(doc.title)}</text>
    <text x="24" y="76" fill="#334155" font-family="ui-monospace, monospace" font-size="22" font-weight="600">${escapeXml(doc.specSummary)} • Bước gân: ${doc.ribPitchMm} mm</text>
  </g>
  ${piecesSvg}
</svg>`;
}
