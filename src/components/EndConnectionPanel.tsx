import { useState } from 'react';
import { Copy, Info } from 'lucide-react';
import { WALL_LABELS } from '../domain/ductRules';
import {
  BE_CHAN_MODE_LABELS,
  BE_CHAN_PRESETS,
  BICH_U_OUTER_LIP_MM,
  END_CONNECTION_SHORT_LABELS,
  getEndAllowanceMm,
  getEndCapEdgeSeam,
  getEndNotchSummary,
} from '../domain/endConnectionRules';
import type {
  BeChanEdgeMode,
  BichUThickness,
  BichVSpec,
  BichVThickness,
  EndConnectionConfig,
  EndConnectionType,
  SeamType,
  WallId,
} from '../types/duct';
import {
  BICH_U_THICKNESSES,
  BICH_V_IN_SPECS,
  BICH_V_SPECS,
  BICH_V_THICKNESSES,
} from '../types/duct';
import { NumericDraftInput } from './NumericDraftInput';

interface EndConnectionPanelProps {
  c1: EndConnectionConfig;
  c2: EndConnectionConfig;
  onUpdateEnd: (end: 'c1' | 'c2', patch: Partial<EndConnectionConfig>) => void;
  onCopyC1ToC2: () => void;
}

const INTEGRAL_OPTIONS: { type: EndConnectionType; label: string; badge: string }[] = [
  { type: 'tdc_tdf', label: 'TDC/TDF', badge: '+48' },
  { type: 'nep_c', label: 'Nẹp C', badge: '+12.5' },
  { type: 'be_chan', label: 'Bẻ chân', badge: '+F mm' },
  { type: 'lcct', label: 'Lưới LCCT', badge: '+20' },
  { type: 'end_cap', label: 'Đầu bịt kín', badge: 'Mí / Hàn' },
  { type: 'plain', label: 'Để thẳng', badge: '+L_thẳng' },
];

const DETACHED_OPTIONS: { type: EndConnectionType; label: string; badge: string }[] = [
  { type: 'bich_v_out', label: 'Bích V ngoài', badge: 'V30–V80' },
  { type: 'bich_v_in', label: 'Bích V trong', badge: 'W−3' },
  { type: 'bich_u', label: 'Bích U rời', badge: 'Lệch cánh' },
];

const PLAIN_EXT_PRESETS = [0, 20, 30, 40, 50] as const;
const WALL_ORDER: WallId[] = ['top', 'bottom', 'left', 'right'];

function isSameConnection(a: EndConnectionConfig, b: EndConnectionConfig): boolean {
  return (
    a.type === b.type &&
    a.showEndIndent === b.showEndIndent &&
    a.bichVSpec === b.bichVSpec &&
    a.bichVThickness === b.bichVThickness &&
    a.bichVOutStyle === b.bichVOutStyle &&
    a.bichUThickness === b.bichUThickness &&
    a.bichUWrapLeg === b.bichUWrapLeg &&
    a.bichUFlangeFace === b.bichUFlangeFace &&
    a.beChanWidth === b.beChanWidth &&
    a.beChanEdges.top === b.beChanEdges.top &&
    a.beChanEdges.bottom === b.beChanEdges.bottom &&
    a.beChanEdges.left === b.beChanEdges.left &&
    a.beChanEdges.right === b.beChanEdges.right &&
    a.plainExtensionMm === b.plainExtensionMm &&
    a.showLcctMesh === b.showLcctMesh &&
    a.endCapSeamType === b.endCapSeamType &&
    a.endCapWeldOverlapWidth === b.endCapWeldOverlapWidth &&
    WALL_ORDER.every((w) => a.endCapEdgeSeams[w] === b.endCapEdgeSeams[w])
  );
}

export function EndConnectionPanel({
  c1,
  c2,
  onUpdateEnd,
  onCopyC1ToC2,
}: EndConnectionPanelProps) {
  const [activeEnd, setActiveEnd] = useState<'c1' | 'c2'>('c1');
  const activeConn = activeEnd === 'c1' ? c1 : c2;
  const bothSynced = isSameConnection(c1, c2);

  const c1Allow = getEndAllowanceMm(c1);
  const c2Allow = getEndAllowanceMm(c2);

  const handlePatch = (patch: Partial<EndConnectionConfig>) => {
    onUpdateEnd(activeEnd, patch);
  };

  const handleSelectType = (type: EndConnectionType) => {
    if (type === 'bich_v_in' && activeConn.bichVSpec === 'V80x30') {
      handlePatch({ type, bichVSpec: 'V40x40' });
    } else {
      handlePatch({ type });
    }
  };

  const hasEndCapOverlap =
    activeConn.type === 'end_cap' &&
    WALL_ORDER.some((w) => getEndCapEdgeSeam(activeConn, w) === 'weld_overlap');

  return (
    <section className="space-y-2.5 border-t border-[#1e2838] pt-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Thư viện Đầu kết nối
        </h2>
        <span className="font-mono text-[10px] font-semibold text-sky-300">
          Bù tối đa: +{c1Allow + c2Allow} mm
        </span>
      </div>

      {/* C1 / C2 Independent Selector Tabs */}
      <div className="grid grid-cols-2 gap-1.5" role="tablist" aria-label="Chọn đầu ống C1 hoặc C2">
        {(
          [
            {
              key: 'c1',
              title: 'Đầu C1 (Trước)',
              short: END_CONNECTION_SHORT_LABELS[c1.type],
              allow: c1Allow,
            },
            {
              key: 'c2',
              title: 'Đầu C2 (Sau)',
              short: END_CONNECTION_SHORT_LABELS[c2.type],
              allow: c2Allow,
            },
          ] as const
        ).map((tab) => {
          const isSelected = activeEnd === tab.key;
          return (
            <button
              key={tab.key}
              id={`tab-end-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveEnd(tab.key)}
              className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                isSelected
                  ? 'border-sky-500/65 bg-sky-500/18 text-slate-100'
                  : 'border-[#232e40] bg-[#141b26] text-slate-400 hover:border-[#334560] hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold tracking-wide uppercase">
                  {tab.title}
                </span>
                <span className="font-mono text-[10px] text-sky-300">+{tab.allow}</span>
              </div>
              <div className="mt-0.5 truncate text-xs font-semibold text-slate-100">
                {tab.short}
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Action: Áp dụng C1 cho cả C2 */}
      <button
        id="btn-copy-c1-c2"
        type="button"
        onClick={onCopyC1ToC2}
        className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
          bothSynced
            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
            : 'border-[#273549] bg-[#161f2d] text-slate-200 hover:border-sky-500/50 hover:bg-[#1c283a] hover:text-sky-200'
        }`}
      >
        <Copy className="h-3.5 w-3.5" />
        <span>
          {bothSynced ? 'C1 & C2 đang đồng bộ — Áp dụng C1 cho cả C2' : 'Áp dụng C1 cho cả C2'}
        </span>
      </button>

      {/* Group 1: Bích liền thân ống */}
      <div className="space-y-1">
        <div className="text-[9.5px] font-semibold tracking-wider text-slate-400 uppercase">
          Bích liền thân ống
        </div>
        <div className="grid grid-cols-2 gap-1">
          {INTEGRAL_OPTIONS.map((opt) => {
            const active = activeConn.type === opt.type;
            return (
              <button
                key={opt.type}
                id={`btn-conn-${activeEnd}-${opt.type}`}
                type="button"
                onClick={() => handleSelectType(opt.type)}
                className={`flex items-center justify-between gap-1 rounded-md border px-2 py-1.5 text-left transition-colors ${
                  active
                    ? 'border-sky-500/65 bg-sky-500/20 text-sky-100'
                    : 'border-[#222d3f] bg-[#141b26] text-slate-300 hover:border-[#344662] hover:bg-[#192231]'
                }`}
              >
                <span className="truncate text-[11px] font-semibold leading-tight">{opt.label}</span>
                <span className="shrink-0 font-mono text-[9.5px] text-slate-400">{opt.badge}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Group 2: Bích rời (KHÔNG vẽ lỗ) */}
      <div className="space-y-1">
        <div className="text-[9.5px] font-semibold tracking-wider text-slate-400 uppercase">
          Bích rời (2 thanh phủ bì + 2 lọt lòng • Không lỗ)
        </div>
        <div className="grid grid-cols-3 gap-1">
          {DETACHED_OPTIONS.map((opt) => {
            const active = activeConn.type === opt.type;
            return (
              <button
                key={opt.type}
                id={`btn-conn-${activeEnd}-${opt.type}`}
                type="button"
                onClick={() => handleSelectType(opt.type)}
                className={`rounded-md border px-1.5 py-1.5 text-center transition-colors ${
                  active
                    ? 'border-sky-500/65 bg-sky-500/20 text-sky-100'
                    : 'border-[#222d3f] bg-[#141b26] text-slate-300 hover:border-[#344662] hover:bg-[#192231]'
                }`}
              >
                <div className="truncate text-[10.5px] font-semibold leading-tight">{opt.label}</div>
                <div className="mt-0.5 font-mono text-[9px] text-slate-400">{opt.badge}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contextual Sub-Parameters */}

      {/* 1. TDC/TDF: Optional small corner indent toggle (default OFF for straight ducts) */}
      {activeConn.type === 'tdc_tdf' && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#232e40] bg-[#141b26] px-2.5 py-2">
          <div>
            <div className="text-[11px] font-semibold text-slate-200">
              Dấu lõm phân biệt đầu
            </div>
            <div className="text-[10px] text-slate-400">
              Vết lõm nhỏ sát góc (dùng cho côn/cút/Z thu; mặc định TẮT với ống thẳng)
            </div>
          </div>
          <button
            id={`toggle-tdc-indent-${activeEnd}`}
            type="button"
            onClick={() => handlePatch({ showEndIndent: !activeConn.showEndIndent })}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              activeConn.showEndIndent ? 'bg-sky-500' : 'bg-[#263244]'
            }`}
            aria-pressed={activeConn.showEndIndent}
            aria-label="Bật tắt dấu lõm phân biệt đầu"
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                activeConn.showEndIndent ? 'translate-x-4.5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      )}

      {/* 2. Bích V quay ngoài */}
      {activeConn.type === 'bich_v_out' && (
        <div className="space-y-2.5 rounded-lg border border-[#232e40] bg-[#141b26] p-2.5">
          <div>
            <div className="mb-1 text-[10px] font-semibold text-slate-400 uppercase">
              Quy cách Bích V quay ngoài
            </div>
            <div className="grid grid-cols-4 gap-1">
              {BICH_V_SPECS.map((spec: BichVSpec) => {
                const active = activeConn.bichVSpec === spec;
                return (
                  <button
                    key={spec}
                    id={`btn-bichv-spec-${activeEnd}-${spec}`}
                    type="button"
                    onClick={() => handlePatch({ bichVSpec: spec })}
                    className={`rounded border py-1 font-mono text-[10.5px] font-semibold transition-colors ${
                      active
                        ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                        : 'border-[#243043] bg-[#0e141d] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {spec.replace('x', '×')}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1 text-[10px] font-semibold text-slate-400 uppercase">
              Độ dày Bích V (mm)
            </div>
            <div className="grid grid-cols-3 gap-1">
              {BICH_V_THICKNESSES.map((th: BichVThickness) => {
                const active = activeConn.bichVThickness === th;
                return (
                  <button
                    key={th}
                    id={`btn-bichv-t-${activeEnd}-${th}`}
                    type="button"
                    onClick={() => handlePatch({ bichVThickness: th })}
                    className={`rounded border py-1 font-mono text-[11px] font-semibold transition-colors ${
                      active
                        ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                        : 'border-[#243043] bg-[#0e141d] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {th} mm
                  </button>
                );
              })}
            </div>
          </div>

          {activeConn.bichVSpec === 'V80x30' ? (
            <div className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1.5 text-[10.5px] leading-snug text-sky-200">
              <strong>Quy cách V80×30:</strong> Cánh 80 mm quay ngoài làm mặt bích, cánh 30 mm đặt{' '}
              <strong>lọt vào lòng chi tiết</strong> → khung bích giảm <strong>W−3 × H−3</strong>{' '}
              và đầu ống cắt thẳng +0 mm.
            </div>
          ) : (
            <div>
              <div className="mb-1 text-[10px] font-semibold text-slate-400 uppercase">
                Hệ ống & kích thước khung
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  id={`btn-bichv-style-${activeEnd}-standard`}
                  type="button"
                  onClick={() => handlePatch({ bichVOutStyle: 'standard' })}
                  className={`rounded border px-2 py-1.5 text-left transition-colors ${
                    activeConn.bichVOutStyle === 'standard'
                      ? 'border-sky-500/60 bg-sky-500/20 text-sky-100'
                      : 'border-[#243043] bg-[#0e141d] text-slate-300'
                  }`}
                >
                  <div className="text-[11px] font-semibold">Ống thường</div>
                  <div className="font-mono text-[9.5px] text-slate-400">W+5 × H+5 • +8 mm</div>
                </button>
                <button
                  id={`btn-bichv-style-${activeEnd}-ei`}
                  type="button"
                  onClick={() => handlePatch({ bichVOutStyle: 'ei' })}
                  className={`rounded border px-2 py-1.5 text-left transition-colors ${
                    activeConn.bichVOutStyle === 'ei'
                      ? 'border-sky-500/60 bg-sky-500/20 text-sky-100'
                      : 'border-[#243043] bg-[#0e141d] text-slate-300'
                  }`}
                >
                  <div className="text-[11px] font-semibold">Ống EI</div>
                  <div className="font-mono text-[9.5px] text-slate-400">W−3 × H−3 • +0 mm</div>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Bích V quay trong */}
      {activeConn.type === 'bich_v_in' && (
        <div className="space-y-2.5 rounded-lg border border-[#232e40] bg-[#141b26] p-2.5">
          <div>
            <div className="mb-1 text-[10px] font-semibold text-slate-400 uppercase">
              Quy cách Bích V quay trong (Phủ bì W−3 × H−3)
            </div>
            <div className="grid grid-cols-3 gap-1">
              {BICH_V_IN_SPECS.map((spec: BichVSpec) => {
                const active = activeConn.bichVSpec === spec;
                return (
                  <button
                    key={spec}
                    id={`btn-bichvin-spec-${activeEnd}-${spec}`}
                    type="button"
                    onClick={() => handlePatch({ bichVSpec: spec })}
                    className={`rounded border py-1 font-mono text-[10.5px] font-semibold transition-colors ${
                      active
                        ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                        : 'border-[#243043] bg-[#0e141d] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {spec.replace('x', '×')}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1 text-[10px] font-semibold text-slate-400 uppercase">
              Độ dày Bích V (mm)
            </div>
            <div className="grid grid-cols-3 gap-1">
              {BICH_V_THICKNESSES.map((th: BichVThickness) => {
                const active = activeConn.bichVThickness === th;
                return (
                  <button
                    key={th}
                    id={`btn-bichvin-t-${activeEnd}-${th}`}
                    type="button"
                    onClick={() => handlePatch({ bichVThickness: th })}
                    className={`rounded border py-1 font-mono text-[11px] font-semibold transition-colors ${
                      active
                        ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                        : 'border-[#243043] bg-[#0e141d] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {th} mm
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. Bích U rời */}
      {activeConn.type === 'bich_u' && (
        <div className="space-y-2.5 rounded-lg border border-[#232e40] bg-[#141b26] p-2.5">
          <div>
            <div className="mb-1 text-[10px] font-semibold text-slate-400 uppercase">
              Độ dày Bích U (mm)
            </div>
            <div className="grid grid-cols-3 gap-1">
              {BICH_U_THICKNESSES.map((th: BichUThickness) => {
                const active = activeConn.bichUThickness === th;
                return (
                  <button
                    key={th}
                    id={`btn-bichu-t-${activeEnd}-${String(th).replace('.', '_')}`}
                    type="button"
                    onClick={() => handlePatch({ bichUThickness: th })}
                    className={`rounded border py-1 font-mono text-[11px] font-semibold transition-colors ${
                      active
                        ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                        : 'border-[#243043] bg-[#0e141d] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {th} mm
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-[#232e40] bg-[#0e141d] p-2">
              <label
                htmlFor={`input-bichu-wrap-${activeEnd}`}
                className="mb-1 block text-[10px] font-medium text-slate-400"
              >
                Cánh ôm thân (mm)
              </label>
              <NumericDraftInput
                id={`input-bichu-wrap-${activeEnd}`}
                value={activeConn.bichUWrapLeg}
                min={15}
                max={80}
                step={5}
                ariaLabel="Cánh ôm thân Bích U (mm)"
                onCommit={(v) => handlePatch({ bichUWrapLeg: v })}
                className="mb-1 w-full rounded bg-[#151c27] px-1.5 py-1 text-center font-mono text-xs font-semibold tabular-nums text-slate-100 ring-1 ring-[#243043] outline-none focus:ring-sky-500/70"
              />
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    handlePatch({ bichUWrapLeg: Math.max(15, activeConn.bichUWrapLeg - 5) })
                  }
                  className="flex h-5 items-center justify-center rounded bg-[#1c2635] text-xs font-semibold text-slate-300 hover:bg-[#263449]"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handlePatch({ bichUWrapLeg: Math.min(80, activeConn.bichUWrapLeg + 5) })
                  }
                  className="flex h-5 items-center justify-center rounded bg-[#1c2635] text-xs font-semibold text-slate-300 hover:bg-[#263449]"
                >
                  +
                </button>
              </div>
            </div>

            <div className="rounded border border-[#232e40] bg-[#0e141d] p-2">
              <label
                htmlFor={`input-bichu-face-${activeEnd}`}
                className="mb-1 block text-[10px] font-medium text-slate-400"
              >
                Mặt bích phẳng (mm)
              </label>
              <NumericDraftInput
                id={`input-bichu-face-${activeEnd}`}
                value={activeConn.bichUFlangeFace}
                min={20}
                max={100}
                step={5}
                ariaLabel="Mặt bích phẳng Bích U (mm)"
                onCommit={(v) => handlePatch({ bichUFlangeFace: v })}
                className="mb-1 w-full rounded bg-[#151c27] px-1.5 py-1 text-center font-mono text-xs font-semibold tabular-nums text-slate-100 ring-1 ring-[#243043] outline-none focus:ring-sky-500/70"
              />
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    handlePatch({ bichUFlangeFace: Math.max(20, activeConn.bichUFlangeFace - 5) })
                  }
                  className="flex h-5 items-center justify-center rounded bg-[#1c2635] text-xs font-semibold text-slate-300 hover:bg-[#263449]"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handlePatch({ bichUFlangeFace: Math.min(100, activeConn.bichUFlangeFace + 5) })
                  }
                  className="flex h-5 items-center justify-center rounded bg-[#1c2635] text-xs font-semibold text-slate-300 hover:bg-[#263449]"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="rounded bg-[#0d121a] px-2 py-1.5 text-[10.5px] text-slate-300">
            Gờ bẻ ngoài cố định:{' '}
            <strong className="font-mono text-sky-300">{BICH_U_OUTER_LIP_MM} mm</strong> quay ngược
            về phía thân ống
          </div>
        </div>
      )}

      {/* 5. Đầu để thẳng: đoạn kéo dài trơn hoàn toàn KHÔNG chạy mí */}
      {activeConn.type === 'plain' && (
        <div className="space-y-2 rounded-lg border border-[#232e40] bg-[#141b26] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <label
                htmlFor={`input-plain-ext-${activeEnd}`}
                className="block text-[11px] font-semibold text-slate-200"
              >
                Chiều dài đoạn để thẳng (mm)
              </label>
              <span className="text-[10px] text-slate-400">
                Đoạn trơn không chạy mí
              </span>
            </div>
            <div className="flex items-center gap-1">
              <NumericDraftInput
                id={`input-plain-ext-${activeEnd}`}
                value={activeConn.plainExtensionMm}
                min={0}
                max={300}
                step={10}
                ariaLabel="Chiều dài đoạn để thẳng (mm)"
                onCommit={(v) => handlePatch({ plainExtensionMm: v })}
                className="w-14 rounded bg-[#0e141d] px-1.5 py-1 text-center font-mono text-xs font-semibold tabular-nums text-sky-200 ring-1 ring-[#243043] outline-none focus:ring-sky-500/70"
              />
              <span className="font-mono text-[10px] text-slate-400">mm</span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {PLAIN_EXT_PRESETS.map((v) => {
              const active = activeConn.plainExtensionMm === v;
              return (
                <button
                  key={v}
                  id={`btn-plain-ext-${activeEnd}-${v}`}
                  type="button"
                  onClick={() => handlePatch({ plainExtensionMm: v })}
                  className={`rounded border py-1 font-mono text-[10.5px] font-semibold transition-colors ${
                    active
                      ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                      : 'border-[#243043] bg-[#0e141d] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {v === 0 ? '0' : `+${v}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Đầu bẻ chân: 5 Presets + Chiều rộng F + Tùy chỉnh độc lập từng cạnh Trên/Dưới/Trái/Phải */}
      {activeConn.type === 'be_chan' && (
        <div className="space-y-2.5 rounded-lg border border-[#232e40] bg-[#141b26] p-2.5">
          {/* Width F */}
          <div className="flex items-center justify-between gap-2 rounded border border-[#232e40] bg-[#0e141d] px-2.5 py-1.5">
            <div>
              <label
                htmlFor={`input-bechan-f-${activeEnd}`}
                className="block text-[11px] font-semibold text-slate-200"
              >
                Chiều rộng bẻ chân F
              </label>
              <span className="text-[10px] text-slate-400">Bù phôi +{activeConn.beChanWidth} mm cho cạnh bẻ</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  handlePatch({ beChanWidth: Math.max(5, activeConn.beChanWidth - 5) })
                }
                className="flex h-6 w-6 items-center justify-center rounded bg-[#1c2635] text-xs font-semibold text-slate-300 hover:bg-[#263449]"
              >
                −
              </button>
              <NumericDraftInput
                id={`input-bechan-f-${activeEnd}`}
                value={activeConn.beChanWidth}
                min={5}
                max={100}
                step={5}
                ariaLabel="Chiều rộng bẻ chân F (mm)"
                onCommit={(v) => handlePatch({ beChanWidth: v })}
                className="w-12 rounded bg-[#151c27] px-1 py-0.5 text-center font-mono text-xs font-semibold tabular-nums text-sky-200 ring-1 ring-[#243043] outline-none focus:ring-sky-500/70"
              />
              <button
                type="button"
                onClick={() =>
                  handlePatch({ beChanWidth: Math.min(100, activeConn.beChanWidth + 5) })
                }
                className="flex h-6 w-6 items-center justify-center rounded bg-[#1c2635] text-xs font-semibold text-slate-300 hover:bg-[#263449]"
              >
                +
              </button>
            </div>
          </div>

          {/* 5 Quick Presets */}
          <div>
            <div className="mb-1 text-[10px] font-semibold text-slate-400 uppercase">
              Chọn nhanh kiểu bẻ chân
            </div>
            <div className="flex flex-wrap gap-1">
              {BE_CHAN_PRESETS.map((pr) => {
                const active = WALL_ORDER.every(
                  (w) => activeConn.beChanEdges[w] === pr.edges[w]
                );
                return (
                  <button
                    key={pr.id}
                    id={`btn-bechan-preset-${activeEnd}-${pr.id}`}
                    type="button"
                    onClick={() => handlePatch({ beChanEdges: { ...pr.edges } })}
                    className={`rounded border px-2 py-1 text-[10px] font-medium transition-colors ${
                      active
                        ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                        : 'border-[#243043] bg-[#0e141d] text-slate-300 hover:border-[#344662]'
                    }`}
                  >
                    {pr.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Per-edge independent selectors: Trên / Dưới / Trái / Phải */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">
              Tùy chỉnh độc lập từng cạnh
            </div>
            {WALL_ORDER.map((wall) => {
              const cur = activeConn.beChanEdges[wall];
              return (
                <div
                  key={wall}
                  className="flex items-center justify-between gap-2 rounded bg-[#0e141d] px-2 py-1"
                >
                  <span className="w-11 text-[11px] font-semibold text-slate-300">
                    {WALL_LABELS[wall]}
                  </span>
                  <div className="grid flex-1 grid-cols-3 gap-1">
                    {(['in', 'out', 'straight'] as BeChanEdgeMode[]).map((mode) => (
                      <button
                        key={mode}
                        id={`btn-bechan-${activeEnd}-${wall}-${mode}`}
                        type="button"
                        onClick={() =>
                          handlePatch({
                            beChanEdges: {
                              ...activeConn.beChanEdges,
                              [wall]: mode,
                            },
                          })
                        }
                        className={`rounded py-0.5 text-[10px] font-medium transition-colors ${
                          cur === mode
                            ? 'bg-sky-500/25 text-sky-200 ring-1 ring-sky-500/50'
                            : 'bg-[#151c27] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {BE_CHAN_MODE_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Lưới chắn côn trùng (LCCT) */}
      {activeConn.type === 'lcct' && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#232e40] bg-[#141b26] px-2.5 py-2">
          <div>
            <div className="text-[11px] font-semibold text-slate-200">
              Khung lưới chắn côn trùng
            </div>
            <div className="text-[10px] text-slate-400">
              Khung viền + thanh chia ô + lưới kim loại ô vuông
            </div>
          </div>
          <button
            id={`toggle-lcct-mesh-${activeEnd}`}
            type="button"
            onClick={() => handlePatch({ showLcctMesh: !activeConn.showLcctMesh })}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              activeConn.showLcctMesh ? 'bg-sky-500' : 'bg-[#263244]'
            }`}
            aria-pressed={activeConn.showLcctMesh}
            aria-label="Bật tắt khung lưới chắn côn trùng"
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                activeConn.showLcctMesh ? 'translate-x-4.5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      )}

      {/* 8. Đầu bịt kín (End Cap): cho phép chuyển từng cạnh sang Mí gò / Hàn chập / Hàn đấu đầu */}
      {activeConn.type === 'end_cap' && (
        <div className="space-y-2 rounded-lg border border-[#232e40] bg-[#141b26] p-2.5">
          <div className="text-[10px] font-semibold text-slate-400 uppercase">
            Kiểu ghép đầu bịt kín (4 cạnh)
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { tp: 'pittsburgh', lb: 'Mí gò', sub: '+31 / +7' },
                { tp: 'weld_overlap', lb: 'Hàn chập', sub: `${activeConn.endCapWeldOverlapWidth} mm` },
                { tp: 'weld_butt', lb: 'Hàn đấu đầu', sub: '0 – 0' },
              ] as const
            ).map((opt) => {
              const allSame = WALL_ORDER.every((w) => getEndCapEdgeSeam(activeConn, w) === opt.tp);
              return (
                <button
                  key={opt.tp}
                  id={`btn-endcap-seam-${activeEnd}-${opt.tp}`}
                  type="button"
                  onClick={() => handlePatch({ endCapSeamType: opt.tp, endCapEdgeSeams: {} })}
                  className={`rounded border px-1 py-1.5 text-center transition-colors ${
                    allSame
                      ? 'border-sky-500/60 bg-sky-500/20 text-sky-100'
                      : 'border-[#243043] bg-[#0e141d] text-slate-300 hover:border-[#344662]'
                  }`}
                >
                  <div className="text-[10.5px] font-semibold leading-tight">{opt.lb}</div>
                  <div className="mt-0.5 font-mono text-[9.5px] text-slate-400">{opt.sub}</div>
                </button>
              );
            })}
          </div>

          {hasEndCapOverlap && (
            <div className="rounded border border-[#232e40] bg-[#0e141d] px-2 py-1.5">
              <div className="mb-1 flex justify-between text-[10.5px]">
                <span className="text-slate-300">Độ rộng hàn chập bịt đầu (7–25 mm)</span>
                <span className="font-mono font-semibold text-amber-300">
                  {activeConn.endCapWeldOverlapWidth} mm
                </span>
              </div>
              <input
                id={`slider-endcap-lap-${activeEnd}`}
                type="range"
                min={7}
                max={25}
                step={1}
                value={activeConn.endCapWeldOverlapWidth}
                onChange={(e) =>
                  handlePatch({ endCapWeldOverlapWidth: Number(e.target.value) })
                }
                className="cad-slider w-full"
              />
            </div>
          )}

          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">
              Đổi riêng từng cạnh đầu bịt kín
            </div>
            {WALL_ORDER.map((wall) => {
              const cur = getEndCapEdgeSeam(activeConn, wall);
              return (
                <div
                  key={wall}
                  className="flex items-center justify-between gap-2 rounded bg-[#0e141d] px-2 py-1"
                >
                  <span className="w-11 text-[10.5px] font-semibold text-slate-300">
                    {WALL_LABELS[wall]}
                  </span>
                  <div className="grid flex-1 grid-cols-3 gap-1">
                    {(
                      [
                        { tp: 'pittsburgh', lb: 'Mí gò' },
                        { tp: 'weld_overlap', lb: 'Hàn chập' },
                        { tp: 'weld_butt', lb: 'Đấu đầu' },
                      ] as { tp: SeamType; lb: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.tp}
                        id={`btn-endcap-edge-${activeEnd}-${wall}-${opt.tp}`}
                        type="button"
                        onClick={() =>
                          handlePatch({
                            endCapEdgeSeams: {
                              ...activeConn.endCapEdgeSeams,
                              [wall]: opt.tp,
                            },
                          })
                        }
                        className={`rounded py-0.5 text-[9.5px] font-medium transition-colors ${
                          cur === opt.tp
                            ? 'bg-sky-500/25 text-sky-200 ring-1 ring-sky-500/50'
                            : 'bg-[#151c27] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.lb}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Technical Summary for Active End */}
      <div className="flex items-start gap-1.5 rounded-lg border border-[#212e42] bg-[#0e1520] px-2.5 py-2 text-[10.5px] leading-relaxed text-slate-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
        <span>{getEndNotchSummary(activeConn)}</span>
      </div>
    </section>
  );
}
