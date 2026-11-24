import { useState } from 'react';
import { Check, ClipboardPaste, Copy, FileCode2, Play } from 'lucide-react';
import { evaluateSplitRecommendation, parseStraightDuctLsx } from '../domain/ductRules';
import type { DuctConfig } from '../types/duct';

interface LsxTabProps {
  config: DuctConfig;
  onApplyConfig: (patch: Partial<DuctConfig>) => void;
}

const SAMPLE_LSX_LINES = [
  'Ống gió KT: 500x320, L1110, tôn 0.75, bích TDC',
  'Ống gió KT: 1200x600, L110, tôn 1.2, 1 đầu bích TDC, 1 đầu để thẳng',
  'Ống gió KT 900x700, L1540, tôn 0.95, 2 đầu bích TDC',
  'Ống gió KT: 1800x1400, L1110, tôn 1.5, mí gò',
];

export function LsxTab({ config, onApplyConfig }: LsxTabProps) {
  const [lsxText, setLsxText] = useState(SAMPLE_LSX_LINES[0]);
  const [parseFeedback, setParseFeedback] = useState<string[] | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleParseLsx = () => {
    const parsed = parseStraightDuctLsx(lsxText);
    if (!parsed.W && !parsed.H && !parsed.L && !parsed.thickness) {
      setParseFeedback(['Chưa nhận diện được kích thước (ví dụ: KT: 500x320, L1110, tôn 0.75).']);
      return;
    }

    const nextW = parsed.W ?? config.W;
    const nextH = parsed.H ?? config.H;
    const nextL = parsed.L ?? config.L;
    const nextT = parsed.thickness ?? config.thickness;
    const rec = evaluateSplitRecommendation(nextW, nextH, nextL);

    onApplyConfig({
      W: nextW,
      H: nextH,
      L: nextL,
      thickness: nextT,
      autoSplit: true,
      splitMode: rec.recommended,
      seamOverrides: {},
    });

    setParseFeedback([
      ...parsed.notes,
      `Tự động chia mảnh: ${rec.reason}`,
    ]);
  };

  const handleCopyJson = async () => {
    const payload = JSON.stringify(
      {
        W: config.W,
        H: config.H,
        L: config.L,
        thickness: config.thickness,
        splitMode: config.splitMode,
        globalSeamType: config.globalSeamType,
        weldOverlapWidth: config.weldOverlapWidth,
        swapSeamRoles: config.swapSeamRoles,
        stiffenerRibs: config.stiffenerRibs,
      },
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setJsonInput(payload);
    }
  };

  const handleImportJson = () => {
    try {
      const obj = JSON.parse(jsonInput);
      const patch: Partial<DuctConfig> = {};
      if (typeof obj.W === 'number') patch.W = Math.max(100, Math.min(3000, obj.W));
      if (typeof obj.H === 'number') patch.H = Math.max(100, Math.min(3000, obj.H));
      if (typeof obj.L === 'number') patch.L = Math.max(40, Math.min(3000, obj.L));
      if (typeof obj.thickness === 'number') patch.thickness = obj.thickness;
      if (typeof obj.splitMode === 'string') {
        patch.splitMode = obj.splitMode;
        patch.autoSplit = false;
      }
      if (typeof obj.globalSeamType === 'string') patch.globalSeamType = obj.globalSeamType;
      if (typeof obj.weldOverlapWidth === 'number') {
        patch.weldOverlapWidth = Math.max(7, Math.min(25, obj.weldOverlapWidth));
      }
      if (typeof obj.swapSeamRoles === 'boolean') patch.swapSeamRoles = obj.swapSeamRoles;
      if (typeof obj.stiffenerRibs === 'boolean') patch.stiffenerRibs = obj.stiffenerRibs;

      onApplyConfig(patch);
      setJsonStatus('Đã nạp thông số JSON vào mô hình 3D.');
    } catch {
      setJsonStatus('Lỗi cú pháp JSON — vui lòng kiểm tra lại.');
    }
  };

  return (
    <div className="space-y-4 pb-5">
      {/* LSX Text Parser */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Dán nội dung Lệnh sản xuất (LSX)
          </h2>
        </div>

        <textarea
          id="textarea-lsx"
          rows={4}
          value={lsxText}
          onChange={(e) => setLsxText(e.target.value)}
          placeholder="Ví dụ: Ống gió KT: 500x320, L1110, tôn 0.75..."
          className="w-full resize-none rounded-lg border border-[#243043] bg-[#0d121a] p-2.5 font-mono text-xs leading-relaxed text-slate-200 placeholder-slate-500 outline-none focus:border-sky-500/60"
        />

        <button
          id="btn-parse-lsx"
          type="button"
          onClick={handleParseLsx}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-500 active:scale-[0.99]"
        >
          <Play className="h-3.5 w-3.5" />
          <span>Phân tích & Dựng ống 3D</span>
        </button>

        {parseFeedback && (
          <div className="space-y-1 rounded-lg border border-[#223247] bg-[#0e1622] p-2.5 text-[11px] text-slate-300">
            {parseFeedback.map((line, idx) => (
              <div key={idx} className="leading-snug">
                • {line}
              </div>
            ))}
          </div>
        )}

        {/* Quick LSX Samples */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] font-medium text-slate-400 uppercase">Mẫu LSX thử nhanh</div>
          {SAMPLE_LSX_LINES.map((sample, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLsxText(sample)}
              className="block w-full truncate rounded-md border border-[#1f2939] bg-[#141b26] px-2.5 py-1.5 text-left font-mono text-[10px] text-slate-300 transition-colors hover:border-[#334663] hover:text-sky-200"
              title={sample}
            >
              {sample}
            </button>
          ))}
        </div>
      </section>

      {/* JSON Import / Export */}
      <section className="space-y-2.5 border-t border-[#1e2838] pt-3.5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            <FileCode2 className="h-3.5 w-3.5" />
            <span>Nhập / Xuất thông số JSON</span>
          </h2>
          <button
            type="button"
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1 rounded bg-[#1a2332] px-2 py-1 text-[10px] font-medium text-sky-300 hover:bg-[#233045]"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép JSON'}</span>
          </button>
        </div>

        <textarea
          rows={4}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='{"W": 800, "H": 500, "L": 1110, "thickness": 0.95}'
          className="w-full resize-none rounded-lg border border-[#243043] bg-[#0d121a] p-2.5 font-mono text-[11px] text-slate-200 placeholder-slate-600 outline-none focus:border-sky-500/60"
        />

        <button
          type="button"
          onClick={handleImportJson}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#273549] bg-[#161f2d] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-sky-500/50 hover:text-sky-200"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          <span>Nạp JSON vào mô hình</span>
        </button>

        {jsonStatus && <p className="text-[11px] text-sky-300">{jsonStatus}</p>}
      </section>
    </div>
  );
}
