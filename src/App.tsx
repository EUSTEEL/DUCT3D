import { useCallback, useState } from 'react';
import { LeftSidebar } from './components/LeftSidebar';
import { TopToolbar } from './components/TopToolbar';
import { ViewportOverlays } from './components/ViewportOverlays';
import { DEFAULT_DUCT_CONFIG, evaluateSplitRecommendation } from './domain/ductRules';
import { DuctScene } from './three/DuctScene';
import type {
  CameraPreset,
  CornerId,
  DuctConfig,
  SeamType,
  SidebarTab,
  SplitMode,
} from './types/duct';

export function App() {
  const [config, setConfig] = useState<DuctConfig>(DEFAULT_DUCT_CONFIG);
  const [activeTab, setActiveTab] = useState<SidebarTab>('params');
  const [cameraCommand, setCameraCommand] = useState<{ preset: CameraPreset; seq: number }>({
    preset: 'iso',
    seq: 0,
  });

  const handlePatchConfig = useCallback((patch: Partial<DuctConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleDimensionChange = useCallback((dim: 'W' | 'H' | 'L', value: number) => {
    setConfig((prev) => {
      const next = { ...prev, [dim]: value };
      if (next.autoSplit) {
        const rec = evaluateSplitRecommendation(next.W, next.H, next.L);
        if (rec.recommended !== next.splitMode) {
          next.splitMode = rec.recommended;
          next.seamOverrides = {};
        }
      }
      return next;
    });
  }, []);

  const handleSelectSplitMode = useCallback((mode: SplitMode) => {
    setConfig((prev) => {
      const rec = evaluateSplitRecommendation(prev.W, prev.H, prev.L);
      return {
        ...prev,
        splitMode: mode,
        autoSplit: mode === rec.recommended,
        seamOverrides: {},
      };
    });
  }, []);

  const handleToggleAutoSplit = useCallback(() => {
    setConfig((prev) => {
      const nextAuto = !prev.autoSplit;
      if (nextAuto) {
        const rec = evaluateSplitRecommendation(prev.W, prev.H, prev.L);
        return {
          ...prev,
          autoSplit: true,
          splitMode: rec.recommended,
          seamOverrides: {},
        };
      }
      return { ...prev, autoSplit: false };
    });
  }, []);

  const handleSwapSeams = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      swapSeamRoles: !prev.swapSeamRoles,
    }));
  }, []);

  const handleUpdateCornerSeam = useCallback(
    (
      cornerId: CornerId,
      patch: { seamType?: SeamType; weldOverlapWidth?: number; inverted?: boolean }
    ) => {
      setConfig((prev) => ({
        ...prev,
        seamOverrides: {
          ...prev.seamOverrides,
          [cornerId]: {
            ...prev.seamOverrides[cornerId],
            ...patch,
          },
        },
      }));
    },
    []
  );

  const handleResetCornerOverrides = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      seamOverrides: {},
    }));
  }, []);

  const handleCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraCommand((prev) => ({ preset, seq: prev.seq + 1 }));
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0f141d] text-slate-100 md:flex-row">
      {/* Left 340px Engineering Control Sidebar */}
      <LeftSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        config={config}
        onChange={handlePatchConfig}
        onDimensionChange={handleDimensionChange}
        onSelectSplitMode={handleSelectSplitMode}
        onToggleAutoSplit={handleToggleAutoSplit}
        onSwapSeams={handleSwapSeams}
        onUpdateCornerSeam={handleUpdateCornerSeam}
        onResetCornerOverrides={handleResetCornerOverrides}
      />

      {/* Right Main Workspace: Quick Toolbar + 3D Studio Viewport */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TopToolbar
          config={config}
          onChange={handlePatchConfig}
          onSwapSeams={handleSwapSeams}
        />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <DuctScene config={config} cameraCommand={cameraCommand} />
          <ViewportOverlays config={config} onCameraPreset={handleCameraPreset} />
        </div>
      </main>
    </div>
  );
}

export default App;
