import { useCallback, useState } from 'react';
import { LeftSidebar } from './components/LeftSidebar';
import { TopToolbar } from './components/TopToolbar';
import { ViewportOverlays } from './components/ViewportOverlays';
import {
  DEFAULT_DUCT_CONFIG,
  evaluateSplitForConfig,
  normalizeThicknessForMaterial,
} from './domain/ductRules';
import { DuctScene } from './three/DuctScene';
import type {
  CameraPreset,
  CornerId,
  DuctConfig,
  EndConnectionConfig,
  SeamType,
  SheetMaterialType,
  SidebarTab,
  SplitMode,
} from './types/duct';

export function App() {
  const [config, setConfig] = useState<DuctConfig>(DEFAULT_DUCT_CONFIG);
  const [activeTab, setActiveTab] = useState<SidebarTab>('params');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [selectedPartCode, setSelectedPartCode] = useState<string | null>(null);
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
        const rec = evaluateSplitForConfig(
          next.W,
          next.H,
          next.L,
          next.sheetMaterial,
          next.c1,
          next.c2
        );
        if (rec.recommended !== next.splitMode) {
          next.splitMode = rec.recommended;
          next.seamOverrides = {};
        }
      }
      return next;
    });
  }, []);

  const handleSheetMaterialChange = useCallback((material: SheetMaterialType) => {
    setConfig((prev) => {
      const nextThickness = normalizeThicknessForMaterial(prev.thickness, material);
      const next: DuctConfig = {
        ...prev,
        sheetMaterial: material,
        thickness: nextThickness,
      };
      if (next.autoSplit) {
        const rec = evaluateSplitForConfig(next.W, next.H, next.L, material, next.c1, next.c2);
        if (rec.recommended !== next.splitMode) {
          next.splitMode = rec.recommended;
          next.seamOverrides = {};
        }
      }
      return next;
    });
  }, []);

  const handleUpdateEndConnection = useCallback(
    (end: 'c1' | 'c2', patch: Partial<EndConnectionConfig>) => {
      setConfig((prev) => {
        const next: DuctConfig = {
          ...prev,
          [end]: {
            ...prev[end],
            ...patch,
          },
        };
        if (next.autoSplit) {
          const rec = evaluateSplitForConfig(
            next.W,
            next.H,
            next.L,
            next.sheetMaterial,
            next.c1,
            next.c2
          );
          if (rec.recommended !== next.splitMode) {
            next.splitMode = rec.recommended;
            next.seamOverrides = {};
          }
        }
        return next;
      });
    },
    []
  );

  const handleCopyC1ToC2 = useCallback(() => {
    setConfig((prev) => {
      const nextC2: EndConnectionConfig = {
        ...prev.c1,
        beChanEdges: { ...prev.c1.beChanEdges },
        endCapEdgeSeams: { ...prev.c1.endCapEdgeSeams },
      };
      const next: DuctConfig = {
        ...prev,
        c2: nextC2,
      };
      if (next.autoSplit) {
        const rec = evaluateSplitForConfig(
          next.W,
          next.H,
          next.L,
          next.sheetMaterial,
          next.c1,
          next.c2
        );
        if (rec.recommended !== next.splitMode) {
          next.splitMode = rec.recommended;
          next.seamOverrides = {};
        }
      }
      return next;
    });
  }, []);

  const handleSelectSplitMode = useCallback((mode: SplitMode) => {
    setSelectedPartCode(null);
    setConfig((prev) => {
      const rec = evaluateSplitForConfig(
        prev.W,
        prev.H,
        prev.L,
        prev.sheetMaterial,
        prev.c1,
        prev.c2
      );
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
        const rec = evaluateSplitForConfig(
          prev.W,
          prev.H,
          prev.L,
          prev.sheetMaterial,
          prev.c1,
          prev.c2
        );
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
      {/* Left 340px Engineering Control Sidebar (collapsible for 100% fullscreen 3D) */}
      {sidebarOpen && (
        <LeftSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onCollapse={() => setSidebarOpen(false)}
          config={config}
          selectedPartCode={selectedPartCode}
          onSelectPart={setSelectedPartCode}
          onChange={handlePatchConfig}
          onDimensionChange={handleDimensionChange}
          onSheetMaterialChange={handleSheetMaterialChange}
          onUpdateEndConnection={handleUpdateEndConnection}
          onCopyC1ToC2={handleCopyC1ToC2}
          onSelectSplitMode={handleSelectSplitMode}
          onToggleAutoSplit={handleToggleAutoSplit}
          onSwapSeams={handleSwapSeams}
          onUpdateCornerSeam={handleUpdateCornerSeam}
          onResetCornerOverrides={handleResetCornerOverrides}
        />
      )}

      {/* Right Main Workspace: Quick Toolbar + 3D Studio Viewport */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopToolbar
          config={config}
          onChange={handlePatchConfig}
          onSwapSeams={handleSwapSeams}
        />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <DuctScene
            config={config}
            cameraCommand={cameraCommand}
            selectedPartCode={selectedPartCode}
            onSelectPart={setSelectedPartCode}
          />
          <ViewportOverlays
            config={config}
            sidebarOpen={sidebarOpen}
            selectedPartCode={selectedPartCode}
            onClearSelection={() => setSelectedPartCode(null)}
            onExpandSidebar={() => setSidebarOpen(true)}
            onCameraPreset={handleCameraPreset}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
