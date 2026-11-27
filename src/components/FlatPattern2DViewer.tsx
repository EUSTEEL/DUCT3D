import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Maximize2,
  Printer,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  buildExportableDxfString,
  formatDxfTimestampFileName,
} from '../domain/dxfExporter';
import {
  buildExportableSvgString,
  escapeXml,
  getDimColor,
  getZoneFillStyle,
  pointsToPath,
} from '../domain/flatPatternSvgExport';
import type { CornerId, FoldEdgeId, SelectionTarget } from '../types/duct';
import type { FlatPatternDocument, FlatPatternPiece } from '../types/flatPattern2d';

interface FlatPattern2DViewerProps {
  document: FlatPatternDocument;
  technicalMode: boolean;
  selection: SelectionTarget;
  onSelectTarget: (target: SelectionTarget) => void;
  onOpenInspector: (target: NonNullable<SelectionTarget>) => void;
  onOpenContextMenu: (x: number, y: number, target: NonNullable<SelectionTarget>) => void;
  focusPartRequest?: { partCode: string; seq: number } | null;
  topLeftOverlay?: ReactNode;
  compact?: boolean;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const VALID_EDGE_IDS = new Set<string>([
  'TL',
  'TR',
  'BR',
  'BL',
  'C1_top',
  'C1_bottom',
  'C1_left',
  'C1_right',
  'C2_top',
  'C2_bottom',
  'C2_left',
  'C2_right',
]);

function resolveHitTarget(el: Element | null): NonNullable<SelectionTarget> | null {
  if (!el) return null;
  const hitEdge = el.closest?.('[data-edge-id]');
  if (hitEdge) {
    const eid = hitEdge.getAttribute('data-edge-id');
    if (eid && VALID_EDGE_IDS.has(eid)) return { kind: 'edge', edgeId: eid as FoldEdgeId };
  }
  const hitEnd = el.closest?.('[data-end-key]');
  if (hitEnd) {
    const k = hitEnd.getAttribute('data-end-key');
    if (k === 'c1' || k === 'c2') return { kind: 'end', endKey: k };
  }
  const hitSeam = el.closest?.('[data-corner-id]');
  if (hitSeam) {
    const cid = hitSeam.getAttribute('data-corner-id') as CornerId | null;
    if (cid === 'TL' || cid === 'TR' || cid === 'BR' || cid === 'BL') {
      return { kind: 'seam', cornerId: cid };
    }
  }
  const hitPiece = el.closest?.('[data-part-code]');
  if (hitPiece) {
    const code = hitPiece.getAttribute('data-part-code');
    if (code) return { kind: 'piece', partCode: code };
  }
  return null;
}

function renderPieceDimensions(piece: FlatPatternPiece) {
  return piece.dimensions.map((d, idx) => {
    const col = getDimColor(d.accent, false);
    const fs = d.tier === 'total' ? 28 : d.tier === 'segment' ? 21 : 19;
    const fw = d.tier === 'total' ? 700 : 600;
    const tick = 7;

    if (d.axis === 'horizontal') {
      const yDim = d.anchor + d.offset;
      const yExtEnd = yDim + (d.offset < 0 ? -12 : 12);
      const midX = (d.start + d.end) * 0.5;
      const span = Math.abs(d.end - d.start);
      const textY = span < 42 ? yDim - 18 : yDim - 8;
      return (
        <g key={`dim-${idx}`} className="pointer-events-none">
          <line
            x1={d.start}
            y1={d.anchor}
            x2={d.start}
            y2={yExtEnd}
            stroke={col}
            strokeOpacity={0.4}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={d.end}
            y1={d.anchor}
            x2={d.end}
            y2={yExtEnd}
            stroke={col}
            strokeOpacity={0.4}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={d.start}
            y1={yDim}
            x2={d.end}
            y2={yDim}
            stroke={col}
            strokeWidth={d.tier === 'total' ? 1.4 : 1.1}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={d.start - tick}
            y1={yDim + tick}
            x2={d.start + tick}
            y2={yDim - tick}
            stroke={col}
            strokeWidth={1.3}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={d.end - tick}
            y1={yDim + tick}
            x2={d.end + tick}
            y2={yDim - tick}
            stroke={col}
            strokeWidth={1.3}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={midX}
            y={textY}
            textAnchor="middle"
            fill={col}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={fs}
            fontWeight={fw}
          >
            {d.label}
          </text>
        </g>
      );
    }

    const xDim = d.anchor + d.offset;
    const xExtEnd = xDim + (d.offset < 0 ? -12 : 12);
    const midY = (d.start + d.end) * 0.5;
    const textX = d.offset < 0 ? xDim - 10 : xDim + 24;
    return (
      <g key={`dim-${idx}`} className="pointer-events-none">
        <line
          x1={d.anchor}
          y1={d.start}
          x2={xExtEnd}
          y2={d.start}
          stroke={col}
          strokeOpacity={0.4}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={d.anchor}
          y1={d.end}
          x2={xExtEnd}
          y2={d.end}
          stroke={col}
          strokeOpacity={0.4}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={xDim}
          y1={d.start}
          x2={xDim}
          y2={d.end}
          stroke={col}
          strokeWidth={d.tier === 'total' ? 1.4 : 1.1}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={xDim - tick}
          y1={d.start + tick}
          x2={xDim + tick}
          y2={d.start - tick}
          stroke={col}
          strokeWidth={1.3}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={xDim - tick}
          y1={d.end + tick}
          x2={xDim + tick}
          y2={d.end - tick}
          stroke={col}
          strokeWidth={1.3}
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={textX}
          y={midY}
          textAnchor="middle"
          transform={`rotate(-90 ${textX} ${midY})`}
          fill={col}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize={fs}
          fontWeight={fw}
        >
          {d.label}
        </text>
      </g>
    );
  });
}

export function FlatPattern2DViewer({
  document: doc,
  technicalMode,
  selection,
  onSelectTarget,
  onOpenInspector,
  onOpenContextMenu,
  focusPartRequest = null,
  topLeftOverlay = null,
  compact = false,
}: FlatPattern2DViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportPx, setViewportPx] = useState<{ w: number; h: number }>({ w: 800, h: 600 });
  const [manualView, setManualView] = useState<{
    sig: string;
    focusSeq: number;
    box: ViewBox;
  } | null>(null);

  const focusSeq = focusPartRequest?.seq ?? 0;
  const layoutSig = `${doc.pieces.length}:${Math.round(doc.bounds.width)}:${Math.round(doc.bounds.height)}:${Math.round(viewportPx.w)}:${Math.round(viewportPx.h)}`;

  const fitViewBox = useMemo<ViewBox>(() => {
    const safeW = Math.max(100, viewportPx.w);
    const safeH = Math.max(100, viewportPx.h);
    const pad = 80;
    const bw = doc.bounds.width + pad * 2;
    const bh = doc.bounds.height + pad * 2;
    const cx = doc.bounds.minX + doc.bounds.width * 0.5;
    const cy = doc.bounds.minY + doc.bounds.height * 0.5;
    const aspect = safeW / safeH;

    let w = bw;
    let h = bh;
    if (w / h < aspect) {
      w = h * aspect;
    } else {
      h = w / aspect;
    }
    return { x: cx - w * 0.5, y: cy - h * 0.5, w, h };
  }, [doc.bounds.height, doc.bounds.minX, doc.bounds.minY, doc.bounds.width, viewportPx.h, viewportPx.w]);

  const baseViewBox = useMemo<ViewBox>(() => {
    if (!focusPartRequest || focusPartRequest.seq <= 0) return fitViewBox;
    const piece = doc.pieces.find((p) => p.partCode === focusPartRequest.partCode);
    if (!piece) return fitViewBox;
    const pad = 210;
    const bw = piece.widthMm + pad * 2;
    const bh = piece.heightMm + pad * 2;
    const cx = piece.originX + piece.widthMm * 0.5;
    const cy = piece.originY + piece.heightMm * 0.5;
    const aspect = Math.max(100, viewportPx.w) / Math.max(100, viewportPx.h);
    let w = bw;
    let h = bh;
    if (w / h < aspect) w = h * aspect;
    else h = w / aspect;
    return { x: cx - w * 0.5, y: cy - h * 0.5, w, h };
  }, [focusPartRequest, doc.pieces, viewportPx.w, viewportPx.h, fitViewBox]);

  const viewBox =
    manualView && manualView.sig === layoutSig && manualView.focusSeq === focusSeq
      ? manualView.box
      : baseViewBox;

  const dragRef = useRef<{
    active: boolean;
    didDrag: boolean;
    startX: number;
    startY: number;
    downTarget: NonNullable<SelectionTarget> | null;
    origBox: ViewBox;
  }>({
    active: false,
    didDrag: false,
    startX: 0,
    startY: 0,
    downTarget: null,
    origBox: fitViewBox,
  });

  // Track container size cleanly
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 20 && rect.height > 20) {
        setViewportPx({ w: rect.width, h: rect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleFit = useCallback(() => {
    setManualView({ sig: layoutSig, focusSeq, box: fitViewBox });
  }, [layoutSig, focusSeq, fitViewBox]);

  const applyZoom = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      setManualView((prevState) => {
        const prev =
          prevState && prevState.sig === layoutSig && prevState.focusSeq === focusSeq
            ? prevState.box
            : baseViewBox;
        const minW = Math.max(120, fitViewBox.w * 0.08);
        const maxW = fitViewBox.w * 4.5;
        const nextW = Math.max(minW, Math.min(maxW, prev.w * factor));
        const actualFactor = nextW / prev.w;
        const nextH = prev.h * actualFactor;

        let rx = 0.5;
        let ry = 0.5;
        if (clientX !== undefined && clientY !== undefined && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          rx = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
          ry = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
        }

        const wx = prev.x + rx * prev.w;
        const wy = prev.y + ry * prev.h;
        return {
          sig: layoutSig,
          focusSeq,
          box: {
            x: wx - rx * nextW,
            y: wy - ry * nextH,
            w: nextW,
            h: nextH,
          },
        };
      });
    },
    [fitViewBox, baseViewBox, layoutSig, focusSeq]
  );

  // Non-passive wheel listener for smooth pointer-anchored zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      applyZoom(factor, e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  const lastDownTargetRef = useRef<NonNullable<SelectionTarget> | null>(null);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const downTarget = resolveHitTarget(e.target as Element | null);
    lastDownTargetRef.current = downTarget;
    dragRef.current = {
      active: true,
      didDrag: false,
      startX: e.clientX,
      startY: e.clientY,
      downTarget,
      origBox: viewBox,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const dr = dragRef.current;
    if (!dr.active || !containerRef.current) return;
    const dxPx = e.clientX - dr.startX;
    const dyPx = e.clientY - dr.startY;
    if (!dr.didDrag && Math.hypot(dxPx, dyPx) > 4) {
      dr.didDrag = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer already released
      }
    }
    if (!dr.didDrag) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = dr.origBox.w / Math.max(1, rect.width);
    const scaleY = dr.origBox.h / Math.max(1, rect.height);
    setManualView({
      sig: layoutSig,
      focusSeq,
      box: {
        ...dr.origBox,
        x: dr.origBox.x - dxPx * scaleX,
        y: dr.origBox.y - dyPx * scaleY,
      },
    });
  };

  const handlePointerUp = () => {
    const dr = dragRef.current;
    const wasDrag = dr.didDrag;
    const target = dr.downTarget;
    dr.active = false;
    dr.didDrag = false;
    dr.downTarget = null;
    if (wasDrag) return;

    // Single-click ONLY highlights target (never toggles off on same target so dblclick works cleanly)
    if (target) {
      onSelectTarget(target);
    } else {
      onSelectTarget(null);
    }
  };

  const handleSvgDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const target = resolveHitTarget(e.target as Element | null) ?? lastDownTargetRef.current;
    if (target) {
      e.preventDefault();
      onOpenInspector(target);
    }
  };

  const handleSvgContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    const target = resolveHitTarget(e.target as Element | null);
    if (target) {
      onOpenContextMenu(e.clientX, e.clientY, target);
    }
  };

  const handleDownloadDxf = useCallback(() => {
    const dxfStr = buildExportableDxfString(doc);
    const blob = new Blob([dxfStr], { type: 'application/dxf;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = formatDxfTimestampFileName();
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [doc]);

  const handlePrintPdf = useCallback(() => {
    const svgStr = buildExportableSvgString(doc, technicalMode);
    const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(doc.title)}</title>
  <style>
    @page { size: landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    svg { max-width: 100%; max-height: 98vh; width: auto; height: auto; display: block; }
  </style>
</head>
<body>
  ${svgStr}
  <script>window.onload = () => { setTimeout(() => { window.focus(); window.print(); }, 180); };</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1200,height=820');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      return;
    }
    // Fallback via hidden iframe if pop-ups are blocked
    const iframe = window.document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    window.document.body.appendChild(iframe);
    const iDoc = iframe.contentWindow?.document;
    if (iDoc) {
      iDoc.open();
      iDoc.write(html);
      iDoc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => window.document.body.removeChild(iframe), 1500);
      }, 250);
    }
  }, [doc, technicalMode]);

  const zoomPercent = useMemo(
    () => Math.round((fitViewBox.w / Math.max(1, viewBox.w)) * 100),
    [fitViewBox.w, viewBox.w]
  );

  const anyDanger = doc.pieces.some((p) => p.limitCheck.severity === 'danger');
  const anyWarn = doc.pieces.some((p) => p.limitCheck.severity === 'warn');
  const anyOverlap2D = doc.pieces.some((p) => p.hasOverlap2D);
  const selectedPartCode = selection?.kind === 'piece' ? selection.partCode : null;
  const selectedEdgeId = selection?.kind === 'edge' ? selection.edgeId : null;

  return (
    <div
      id="flat-pattern-2d-viewer"
      className="relative flex h-full w-full flex-col overflow-hidden bg-[#0c121b] select-none"
    >
      {/* Top 2D CAD Utility Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f2b3d] bg-[#101723]/95 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-sky-500/18 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-sky-300 ring-1 ring-sky-500/40">
            2D LASER
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-slate-100">
              {compact
                ? `Trải phẳng ${doc.pieces.length} mảnh • Tấm ${doc.sheetWidthMm}×${doc.sheetLengthMm}`
                : doc.title}
            </div>
            {!compact && (
              <div className="truncate font-mono text-[10.5px] text-slate-400">
                {doc.specSummary}
              </div>
            )}
          </div>
        </div>

        {/* Zoom / Pan Fit + Export DXF & Print/PDF buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center rounded-lg border border-[#243247] bg-[#0b1018] p-0.5">
            <button
              id="btn-2d-zoom-out"
              type="button"
              onClick={() => applyZoom(1.22)}
              title="Thu nhỏ 2D"
              className="rounded p-1 text-slate-300 transition-colors hover:bg-[#1b2638] hover:text-white"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="w-11 text-center font-mono text-[11px] font-medium tabular-nums text-sky-300">
              {zoomPercent}%
            </span>
            <button
              id="btn-2d-zoom-in"
              type="button"
              onClick={() => applyZoom(0.82)}
              title="Phóng to 2D"
              className="rounded p-1 text-slate-300 transition-colors hover:bg-[#1b2638] hover:text-white"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              id="btn-2d-fit"
              type="button"
              onClick={handleFit}
              title="Vừa màn hình (Fit)"
              className="ml-0.5 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:bg-[#1b2638] hover:text-sky-200"
            >
              <Maximize2 className="h-3.5 w-3.5 text-sky-400" />
              <span>Vừa màn hình</span>
            </button>
          </div>

          <button
            id="btn-2d-download-dxf"
            type="button"
            onClick={handleDownloadDxf}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-500/45 bg-sky-500/15 px-2.5 py-1 text-[11.5px] font-medium text-sky-200 transition-colors hover:bg-sky-500/25 hover:text-white"
            title="Xuất file DXF chuẩn AutoCAD & Bodor Thinker (tỷ lệ 1:1 mm, 2 layer CUT & DIM)"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span>Tải file DXF</span>
          </button>

          <button
            id="btn-2d-print-pdf"
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1 rounded-lg border border-[#28364d] bg-[#161f2d] px-2.5 py-1 text-[11.5px] font-medium text-slate-200 transition-colors hover:border-sky-500/50 hover:text-sky-200"
            title={`In trực tiếp hoặc Lưu PDF bản cắt Laser 2D kèm đường chấn, gân ${doc.ribPitchMm} mm & nhãn mảnh`}
          >
            <Printer className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            <span>In / Lưu PDF</span>
          </button>
        </div>
      </div>

      {/* Interactive 2D Blueprint Canvas */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#151f2e_0%,#0c121b_72%,#090e15_100%)]"
      >
        {topLeftOverlay && (
          <div className="absolute top-2.5 left-3 z-20 flex items-center gap-2">
            {topLeftOverlay}
          </div>
        )}
        <svg
          id="flat-pattern-svg"
          className="h-full w-full cursor-grab active:cursor-grabbing"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleSvgDoubleClick}
          onContextMenu={handleSvgContextMenu}
        >
          <defs>
            {/* Subtle 100mm & 500mm CAD engineering grid */}
            <pattern id="cadGrid100" width="100" height="100" patternUnits="userSpaceOnUse">
              <path
                d="M 100 0 L 0 0 0 100"
                fill="none"
                stroke="#1c2a3e"
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
            <pattern id="cadGrid500" width="500" height="500" patternUnits="userSpaceOnUse">
              <rect width="500" height="500" fill="url(#cadGrid100)" />
              <path
                d="M 500 0 L 0 0 0 500"
                fill="none"
                stroke="#263852"
                strokeWidth="1.1"
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
            {/* Orange diagonal hatch for 2D self-overlapping unfolded regions */}
            <pattern
              id="overlapHatch"
              width="28"
              height="28"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="28" height="28" fill="rgba(249, 115, 22, 0.22)" />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="28"
                stroke="#f97316"
                strokeWidth="4"
                strokeOpacity="0.85"
              />
            </pattern>
          </defs>

          {/* Infinite CAD Grid backdrop */}
          <rect
            x={viewBox.x - viewBox.w}
            y={viewBox.y - viewBox.h}
            width={viewBox.w * 3}
            height={viewBox.h * 3}
            fill="url(#cadGrid500)"
          />

          {/* Render all flat-pattern pieces in exact 1:1 mm coordinates */}
          {doc.pieces.map((piece) => {
            const isSelected = selectedPartCode === piece.partCode;
            const cutD = pointsToPath(piece.cutPolygon);
            const lc = piece.limitCheck;

            // Sheet guide aligns with the piece's valid cutting orientation (0° or 90°)
            const showHorizSheetLine =
              lc.orientation === 'vuot_kho' ||
              (lc.orientation === 'ngang_chuan' && !piece.isEndCap && doc.sheetWidthMm - piece.heightMm <= 260);
            const collidesRightNeighbor = doc.pieces.some(
              (other) =>
                other.id !== piece.id &&
                Math.abs(other.originY - piece.originY) < 400 &&
                other.originX > piece.originX &&
                piece.originX + doc.sheetWidthMm >= other.originX - 180
            );
            const showVertSheetLine =
              lc.orientation === 'doc_6000' &&
              doc.sheetWidthMm - piece.widthMm <= 420 &&
              !collidesRightNeighbor;
            // Roll-former guide ONLY along Y (L_phôi, perpendicular to ribs!)
            const showRollY =
              piece.ribLines.length > 0 && piece.heightMm > doc.rollFormerLimitMm - 250;

            const limitColor =
              lc.severity === 'danger'
                ? '#ef4444'
                : lc.severity === 'warn'
                  ? '#f59e0b'
                  : '#10b981';

            const c2Selected = selection?.kind === 'end' && selection.endKey === 'c2';
            const c1Selected = selection?.kind === 'end' && selection.endKey === 'c1';
            const leftSeamSelected =
              !piece.isEndCap &&
              !piece.isMergedTree &&
              piece.leftCornerId &&
              selection?.kind === 'seam' &&
              selection.cornerId === piece.leftCornerId;
            const rightSeamSelected =
              !piece.isEndCap &&
              !piece.isMergedTree &&
              piece.rightCornerId &&
              selection?.kind === 'seam' &&
              selection.cornerId === piece.rightCornerId;

            const endBandH = (band: number) => Math.max(26, band);
            const seamBandW = 34;

            return (
              <g
                key={piece.id}
                data-part-code={piece.partCode}
                data-limit-severity={lc.severity}
                data-limit-orientation={lc.orientation}
                data-overlap-2d={piece.hasOverlap2D ? 'true' : 'false'}
                transform={`translate(${piece.originX}, ${piece.originY})`}
                className="cursor-pointer"
              >
                {/* Orange Self-Overlap 2D Warning Frame (Free-Merge Net Check) */}
                {piece.hasOverlap2D && (
                  <g className="pointer-events-none">
                    <rect
                      x={-22}
                      y={-22}
                      width={piece.widthMm + 44}
                      height={piece.heightMm + 44}
                      rx={10}
                      fill="rgba(249, 115, 22, 0.08)"
                      stroke="#f97316"
                      strokeWidth={2.6}
                      strokeDasharray="12 6"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={piece.widthMm * 0.5}
                      y={lc.severity !== 'ok' ? -242 : -206}
                      textAnchor="middle"
                      fill="#fb923c"
                      fontFamily="system-ui, sans-serif"
                      fontSize={23}
                      fontWeight={700}
                    >
                      ⚠ {piece.overlapWarning ?? 'Cảnh báo: Có vùng phôi 2D chồng lấn — hãy đổi cạnh ghép'}
                    </text>
                  </g>
                )}

                {/* Sheet-width / Roll-former warning frame ONLY when actually exceeding limits */}
                {lc.severity !== 'ok' && (
                  <g className="pointer-events-none">
                    <rect
                      x={-16}
                      y={-16}
                      width={piece.widthMm + 32}
                      height={piece.heightMm + 32}
                      rx={8}
                      fill={
                        lc.severity === 'danger'
                          ? 'rgba(239, 68, 68, 0.06)'
                          : 'rgba(245, 158, 11, 0.05)'
                      }
                      stroke={limitColor}
                      strokeWidth={2}
                      strokeDasharray="10 6"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={piece.widthMm * 0.5}
                      y={-206}
                      textAnchor="middle"
                      fill={lc.severity === 'danger' ? '#fca5a5' : '#fcd34d'}
                      fontFamily="system-ui, sans-serif"
                      fontSize={23}
                      fontWeight={700}
                    >
                      ⚠ {lc.statusText}
                    </text>
                  </g>
                )}

                {/* Subtle Green Status Badge when rotated longitudinal fits 100% cleanly */}
                {lc.severity === 'ok' && lc.orientation === 'doc_6000' && !piece.hasOverlap2D && (
                  <text
                    x={piece.widthMm * 0.5}
                    y={-206}
                    textAnchor="middle"
                    fill="#6ee7b7"
                    fontFamily="system-ui, sans-serif"
                    fontSize={21}
                    fontWeight={700}
                    className="pointer-events-none"
                  >
                    ✓ {lc.statusText}
                  </text>
                )}

                {/* Sheet body fill */}
                <path
                  d={cutD}
                  fill={isSelected ? 'rgba(14, 165, 233, 0.14)' : 'rgba(203, 213, 225, 0.08)'}
                  stroke="none"
                />

                {/* Technical color zone overlays (Mí kép đỏ / Mí đơn xanh dương / Mí hàn cam / Bích vàng) */}
                {technicalMode &&
                  piece.zoneFills.map((z, zi) => (
                    <path
                      key={`z-${zi}`}
                      d={pointsToPath(z.points)}
                      fill={getZoneFillStyle(z.kind, false)}
                      stroke="none"
                    />
                  ))}

                {/* Hatched Orange Rectangles marking exact 2D overlapping face regions */}
                {piece.hasOverlap2D &&
                  piece.overlapRects?.map((ov, oi) => (
                    <rect
                      key={`ov-${oi}`}
                      x={ov.x}
                      y={ov.y}
                      width={ov.w}
                      height={ov.h}
                      fill="url(#overlapHatch)"
                      stroke="#f97316"
                      strokeWidth={2.2}
                      vectorEffect="non-scaling-stroke"
                      className="pointer-events-none"
                    />
                  ))}

                {/* Interactive C2 (top), C1 (bottom), and Left/Right Seam edge hit zones for linear body pieces */}
                {!piece.isEndCap && !piece.isMergedTree && (
                  <>
                    {/* C2 Top End Zone */}
                    <rect
                      data-end-key="c2"
                      x={0}
                      y={0}
                      width={piece.widthMm}
                      height={endBandH(piece.bodyTopY ?? 26)}
                      fill={c2Selected ? 'rgba(251, 191, 36, 0.2)' : 'transparent'}
                      stroke={c2Selected ? '#fbbf24' : 'none'}
                      strokeWidth={1.8}
                      vectorEffect="non-scaling-stroke"
                      className="cursor-pointer"
                    />
                    {/* C1 Bottom End Zone */}
                    <rect
                      data-end-key="c1"
                      x={0}
                      y={Math.min(
                        piece.bodyBottomY ?? piece.heightMm - 26,
                        piece.heightMm - endBandH(piece.heightMm - (piece.bodyBottomY ?? piece.heightMm))
                      )}
                      width={piece.widthMm}
                      height={endBandH(piece.heightMm - (piece.bodyBottomY ?? piece.heightMm))}
                      fill={c1Selected ? 'rgba(251, 191, 36, 0.2)' : 'transparent'}
                      stroke={c1Selected ? '#fbbf24' : 'none'}
                      strokeWidth={1.8}
                      vectorEffect="non-scaling-stroke"
                      className="cursor-pointer"
                    />
                    {/* Left Seam Edge Hit Zone */}
                    {piece.leftCornerId && (
                      <rect
                        data-corner-id={piece.leftCornerId}
                        x={0}
                        y={endBandH(piece.bodyTopY ?? 26)}
                        width={Math.min(seamBandW, piece.widthMm * 0.14)}
                        height={Math.max(
                          20,
                          piece.heightMm -
                            endBandH(piece.bodyTopY ?? 26) -
                            endBandH(piece.heightMm - (piece.bodyBottomY ?? piece.heightMm))
                        )}
                        fill={leftSeamSelected ? 'rgba(52, 211, 153, 0.24)' : 'transparent'}
                        stroke={leftSeamSelected ? '#34d399' : 'none'}
                        strokeWidth={1.8}
                        vectorEffect="non-scaling-stroke"
                        className="cursor-pointer"
                      />
                    )}
                    {/* Right Seam Edge Hit Zone */}
                    {piece.rightCornerId && (
                      <rect
                        data-corner-id={piece.rightCornerId}
                        x={piece.widthMm - Math.min(seamBandW, piece.widthMm * 0.14)}
                        y={endBandH(piece.bodyTopY ?? 26)}
                        width={Math.min(seamBandW, piece.widthMm * 0.14)}
                        height={Math.max(
                          20,
                          piece.heightMm -
                            endBandH(piece.bodyTopY ?? 26) -
                            endBandH(piece.heightMm - (piece.bodyBottomY ?? piece.heightMm))
                        )}
                        fill={rightSeamSelected ? 'rgba(52, 211, 153, 0.24)' : 'transparent'}
                        stroke={rightSeamSelected ? '#34d399' : 'none'}
                        strokeWidth={1.8}
                        vectorEffect="non-scaling-stroke"
                        className="cursor-pointer"
                      />
                    )}
                  </>
                )}

                {/* Seam & flange fold boundary lines */}
                {piece.foldLines.map((l, li) => (
                  <line
                    key={`f-${li}`}
                    x1={l.x1}
                    y1={l.y1}
                    x2={l.x2}
                    y2={l.y2}
                    stroke="#64748b"
                    strokeWidth={1.1}
                    strokeDasharray="6 4"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-none"
                  />
                ))}

                {/* 90° Press-brake bend lines (Đường chấn — supports both vertical & horizontal bends) */}
                {piece.bendLines.map((l, bi) => {
                  const isHoriz = Math.abs(l.y2 - l.y1) < Math.abs(l.x2 - l.x1);
                  const mx = (l.x1 + l.x2) * 0.5;
                  const my = (l.y1 + l.y2) * 0.5;
                  return (
                    <g key={`b-${bi}`} className="pointer-events-none">
                      <line
                        x1={l.x1}
                        y1={l.y1}
                        x2={l.x2}
                        y2={l.y2}
                        stroke="#22c55e"
                        strokeWidth={1.5}
                        strokeDasharray="10 6"
                        vectorEffect="non-scaling-stroke"
                      />
                      <text
                        x={isHoriz ? mx : l.x1 - 8}
                        y={isHoriz ? l.y1 - 8 : my}
                        textAnchor="middle"
                        transform={isHoriz ? undefined : `rotate(-90 ${l.x1 - 8} ${my})`}
                        fill="#4ade80"
                        fillOpacity={0.78}
                        fontFamily="ui-monospace, monospace"
                        fontSize={16}
                        fontWeight={600}
                      >
                        CHẤN 90°
                      </text>
                    </g>
                  );
                })}

                {/* Interactive Shared Edges on 2D (click / double-click / right-click bend or merged cap edges) */}
                {piece.interactiveEdges?.map((ie, iei) => {
                  const isEdgeSel = selectedEdgeId === ie.edgeId;
                  return (
                    <g key={`ie-${ie.edgeId}-${iei}`}>
                      {isEdgeSel && (
                        <line
                          x1={ie.x1}
                          y1={ie.y1}
                          x2={ie.x2}
                          y2={ie.y2}
                          stroke="#38bdf8"
                          strokeWidth={3.2}
                          vectorEffect="non-scaling-stroke"
                          className="pointer-events-none"
                        />
                      )}
                      <line
                        data-edge-id={ie.edgeId}
                        x1={ie.x1}
                        y1={ie.y1}
                        x2={ie.x2}
                        y2={ie.y2}
                        stroke="transparent"
                        strokeWidth={18}
                        vectorEffect="non-scaling-stroke"
                        className="cursor-pointer"
                      />
                    </g>
                  );
                })}

                {/* Straight Stiffener Ribs (ALWAYS parallel to C1/C2, configurable pitch from Workshop Settings) */}
                {piece.ribLines.map((l, ri) => (
                  <line
                    key={`r-${ri}`}
                    x1={l.x1}
                    y1={l.y1}
                    x2={l.x2}
                    y2={l.y2}
                    stroke="#38bdf8"
                    strokeOpacity={0.62}
                    strokeWidth={1.1}
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-none"
                  />
                ))}

                {/* Watertight Outer Laser-Cut Contour */}
                <path
                  d={cutD}
                  fill="none"
                  stroke={piece.hasOverlap2D ? '#fb923c' : isSelected ? '#38bdf8' : '#e2e8f0'}
                  strokeWidth={isSelected || piece.hasOverlap2D ? 2.6 : 1.75}
                  strokeLinejoin="miter"
                  vectorEffect="non-scaling-stroke"
                  className="pointer-events-none"
                />

                {/* Sheet-Limit Guide (Horizontal for ngang_chuan or overflow; Vertical GREEN for valid rotated doc_6000!) */}
                {showHorizSheetLine && (
                  <g className="pointer-events-none">
                    <line
                      x1={-28}
                      y1={doc.sheetWidthMm}
                      x2={piece.widthMm + 28}
                      y2={doc.sheetWidthMm}
                      stroke={lc.orientation === 'vuot_kho' ? '#f87171' : '#34d399'}
                      strokeWidth={1.6}
                      strokeDasharray="10 5"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={piece.widthMm + 34}
                      y={doc.sheetWidthMm + 7}
                      textAnchor="start"
                      fill={lc.orientation === 'vuot_kho' ? '#fca5a5' : '#6ee7b7'}
                      fontFamily="ui-monospace, monospace"
                      fontSize={20}
                      fontWeight={700}
                    >
                      Khổ {doc.sheetWidthMm}
                    </text>
                  </g>
                )}

                {showVertSheetLine && (
                  <g className="pointer-events-none">
                    <line
                      x1={doc.sheetWidthMm}
                      y1={-24}
                      x2={doc.sheetWidthMm}
                      y2={piece.heightMm + 24}
                      stroke="#34d399"
                      strokeWidth={1.6}
                      strokeDasharray="10 5"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={doc.sheetWidthMm + 16}
                      y={24}
                      textAnchor="start"
                      fill="#6ee7b7"
                      fontFamily="ui-monospace, monospace"
                      fontSize={19}
                      fontWeight={700}
                    >
                      Khổ {doc.sheetWidthMm} (Xoay dọc)
                    </text>
                  </g>
                )}

                {/* Roll-former guide ONLY along Y (L_phôi, perpendicular to ribs!) */}
                {showRollY && (
                  <g className="pointer-events-none">
                    <line
                      x1={-24}
                      y1={doc.rollFormerLimitMm}
                      x2={piece.widthMm + 24}
                      y2={doc.rollFormerLimitMm}
                      stroke={lc.exceedsRollFormer ? '#fb923c' : '#34d399'}
                      strokeWidth={1.5}
                      strokeDasharray="8 5"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={piece.widthMm + 30}
                      y={doc.rollFormerLimitMm + 7}
                      fill={lc.exceedsRollFormer ? '#fdba74' : '#6ee7b7'}
                      fontFamily="ui-monospace, monospace"
                      fontSize={19}
                      fontWeight={700}
                    >
                      Lăn gân {doc.rollFormerLimitMm}
                    </text>
                  </g>
                )}

                {/* Subtle Wall Face Watermarks (TRÊN, TRÁI, DƯỚI, PHẢI, BỊT C1...) */}
                {piece.wallLabels.map((wl, wi) => (
                  <text
                    key={`wl-${wi}`}
                    x={wl.x}
                    y={wl.y}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fillOpacity={0.55}
                    fontFamily="ui-monospace, monospace"
                    fontSize={20}
                    fontWeight={600}
                    className="pointer-events-none"
                  >
                    {wl.text} {wl.subtext ? `(${wl.subtext})` : ''}
                  </text>
                ))}

                {/* Center Piece Code Badge (`1-A`, `1-B`, `1-E`...) & Viewing Face Note */}
                <g
                  transform={`translate(${piece.centerLabelPos.x}, ${piece.centerLabelPos.y})`}
                  className="pointer-events-none"
                >
                  <rect
                    x={-215}
                    y={-40}
                    width={430}
                    height={128}
                    rx={12}
                    fill="rgba(12, 18, 28, 0.84)"
                    stroke={isSelected ? '#38bdf8' : '#24344c'}
                    strokeWidth={1.4}
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={-68}
                    y={-28}
                    width={136}
                    height={48}
                    rx={8}
                    fill={isSelected ? 'rgba(14, 165, 233, 0.92)' : 'rgba(20, 30, 46, 0.96)'}
                    stroke={isSelected ? '#e0f2fe' : '#38bdf8'}
                    strokeOpacity={isSelected ? 1 : 0.7}
                    strokeWidth={1.6}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={0}
                    y={8}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fontSize={36}
                    fontWeight={800}
                  >
                    {piece.partCode}
                  </text>
                  <text
                    x={0}
                    y={46}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontFamily="system-ui, sans-serif"
                    fontSize={19}
                    fontWeight={600}
                  >
                    {piece.viewingFaceNote}
                  </text>
                  <text
                    x={0}
                    y={72}
                    textAnchor="middle"
                    fill="#7dd3fc"
                    fontFamily="ui-monospace, monospace"
                    fontSize={17}
                    fontWeight={500}
                  >
                    {piece.subtitle}
                  </text>
                </g>

                {/* Mechanical Extension & Dimension Lines */}
                {renderPieceDimensions(piece)}

                {/* Notch / Seam-stop / End-Indent Callouts */}
                {piece.callouts.map((c, ci) => (
                  <text
                    key={`co-${ci}`}
                    x={c.x}
                    y={c.y}
                    textAnchor={c.align ?? 'middle'}
                    fill={
                      c.tone === 'amber'
                        ? '#fbbf24'
                        : c.tone === 'sky'
                          ? '#7dd3fc'
                          : c.tone === 'red'
                            ? '#f87171'
                            : '#94a3b8'
                    }
                    fontFamily="system-ui, sans-serif"
                    fontSize={20}
                    fontWeight={600}
                    className="pointer-events-none"
                  >
                    {c.text}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>

        {/* Subtle Pan/Zoom Helper Pill */}
        <div className="pointer-events-none absolute top-2.5 right-3 rounded-md border border-[#223045] bg-[#0c121b]/82 px-2 py-0.5 text-[10.5px] text-slate-400 backdrop-blur-xs">
          Cuộn: Zoom • Kéo: Di chuyển • Click: Chọn • Click đúp: Chỉnh nhanh • Chuột phải: Menu
        </div>
      </div>

      {/* Bottom Compact CAD Legend & Sheet Limit Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1f2b3d] bg-[#101723]/95 px-3 py-1.5 text-[10.5px] text-slate-300">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 bg-slate-200" />
            <span>Nét cắt Laser</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 border-t-2 border-dashed border-emerald-400" />
            <span>Đường chấn 90° (khe 2 mm)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 bg-sky-400/80" />
            <span>Gân thẳng {doc.ribPitchMm} mm</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 border-t border-dashed border-slate-400" />
            <span>Ranh giới mí/bích</span>
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          {anyOverlap2D && (
            <span
              id="badge-2d-overlap-warn"
              className="inline-flex items-center gap-1 rounded bg-orange-500/20 px-1.5 py-0.5 font-sans font-semibold text-orange-200 ring-1 ring-orange-500/50"
            >
              <AlertTriangle className="h-3 w-3 shrink-0 text-orange-400" />
              <span>Trùng vùng 2D</span>
            </span>
          )}
          <span
            id="badge-2d-limit-status"
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
              anyDanger
                ? 'bg-red-500/18 text-red-200 ring-1 ring-red-500/45'
                : anyWarn
                  ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/35'
                  : 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/30'
            }`}
          >
            {anyDanger || anyWarn ? (
              <AlertTriangle className="h-3 w-3 shrink-0" />
            ) : (
              <CheckCircle2 className="h-3 w-3 shrink-0" />
            )}
            <span>
              Tấm {doc.sheetWidthMm}×{doc.sheetLengthMm} • Lăn gân {doc.rollFormerLimitMm}
            </span>
          </span>
          <span className="font-semibold text-sky-300">
            Tổng S: {doc.totalAreaM2.toFixed(2)} m²
          </span>
        </div>
      </div>
    </div>
  );
}
