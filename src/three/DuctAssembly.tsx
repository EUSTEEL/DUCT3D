import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { AccessoryKind, BuiltFaceLabel } from '../domain/endConnectionBuilder';
import { buildDuctAssembly } from '../domain/sheetProfileBuilder';
import type { DuctConfig } from '../types/duct';
import { createFaceLabelTexture } from './faceLabelTexture';
import { createDuctMaterialSet } from './galvanizedMaterial';

interface DuctAssemblyProps {
  config: DuctConfig;
  selectedPartCode: string | null;
  onSelectPart: (partCode: string | null) => void;
}

interface InnerFaceDecalProps {
  label: BuiltFaceLabel;
  selected: boolean;
  onClickPart: (e: ThreeEvent<MouseEvent>, partCode: string) => void;
}

function InnerFaceDecal({ label, selected, onClickPart }: InnerFaceDecalProps) {
  const texture = useMemo(
    () => createFaceLabelTexture(label.partCode, selected),
    [label.partCode, selected]
  );

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  return (
    <mesh
      position={label.position}
      rotation={label.rotation}
      onClick={(e) => onClickPart(e, label.partCode)}
      renderOrder={2}
    >
      <planeGeometry args={label.sizeM} />
      <meshBasicMaterial
        map={texture}
        transparent
        side={THREE.FrontSide}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}

/**
 * Renders the parametric 3D straight duct assembly (Stage 1 + revised Stage 2 end connections)
 * with smooth animation between Chưa gò mí ↔ Đã gò mí, crisp mechanical edge lines,
 * interactive click-to-select pieces/faces, and crisp inner-face markings (`1-A`, `1-B`, ...).
 */
export function DuctAssembly({ config, selectedPartCode, onSelectPart }: DuctAssemblyProps) {
  const materialSet = useMemo(() => createDuctMaterialSet(), []);

  useEffect(() => {
    return () => {
      materialSet.dispose();
    };
  }, [materialSet]);

  // Smoothly animate seamLockProgress (0 = Chưa gò mí, 1 = Đã gò mí)
  const targetSeamLock = config.seamState === 'seamed' ? 1 : 0;
  const seamProgressRef = useRef<number>(targetSeamLock);
  const [renderedSeamProgress, setRenderedSeamProgress] = useState<number>(targetSeamLock);

  useFrame((_, delta) => {
    const diff = targetSeamLock - seamProgressRef.current;
    if (Math.abs(diff) > 0.002) {
      const step = Math.min(1, delta * 9.5);
      const next = seamProgressRef.current + diff * step;
      seamProgressRef.current = Math.abs(targetSeamLock - next) < 0.008 ? targetSeamLock : next;
      setRenderedSeamProgress(seamProgressRef.current);
    } else if (seamProgressRef.current !== targetSeamLock) {
      seamProgressRef.current = targetSeamLock;
      setRenderedSeamProgress(targetSeamLock);
    }
  });

  const explodeRatio = config.explode / 100;
  const {
    W,
    H,
    L,
    thickness,
    splitMode,
    globalSeamType,
    weldOverlapWidth,
    swapSeamRoles,
    seamOverrides,
    c1,
    c2,
    stiffenerRibs,
    showFaceLabels,
  } = config;

  const assembly = useMemo(() => {
    const geomConfig: DuctConfig = {
      W,
      H,
      L,
      sheetMaterial: 'galvanized',
      thickness,
      autoSplit: false,
      splitMode,
      globalSeamType,
      weldOverlapWidth,
      swapSeamRoles,
      seamOverrides,
      c1,
      c2,
      seamState: renderedSeamProgress >= 0.5 ? 'seamed' : 'unseamed',
      explode: explodeRatio * 100,
      stiffenerRibs,
      showFaceLabels,
      materialMode: 'realistic',
    };
    return buildDuctAssembly(geomConfig, renderedSeamProgress, explodeRatio);
  }, [
    W,
    H,
    L,
    thickness,
    splitMode,
    globalSeamType,
    weldOverlapWidth,
    swapSeamRoles,
    seamOverrides,
    c1,
    c2,
    stiffenerRibs,
    showFaceLabels,
    renderedSeamProgress,
    explodeRatio,
  ]);

  // Dispose geometries cleanly whenever assembly regenerates
  useEffect(() => {
    return () => {
      assembly.pieces.forEach((p) => {
        p.geometry.dispose();
        p.edgesGeometry.dispose();
      });
      assembly.weldBeads.forEach((b) => b.geometry.dispose());
      assembly.accessories.forEach((a) => {
        a.geometry.dispose();
        a.edgesGeometry?.dispose();
      });
    };
  }, [assembly]);

  const isTech = config.materialMode === 'technical';
  const activeMaterials = isTech
    ? materialSet.technicalMaterials
    : config.sheetMaterial === 'inox'
      ? materialSet.inoxMaterials
      : materialSet.galvanizedMaterials;

  const edgeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: config.materialMode === 'realistic' ? '#0c131f' : '#090e17',
      transparent: true,
      opacity:
        config.materialMode === 'technical'
          ? 0.62
          : config.sheetMaterial === 'inox'
            ? 0.36
            : 0.42,
      depthWrite: false,
    });
  }, [config.materialMode, config.sheetMaterial]);

  const selectedEdgeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
  }, []);

  useEffect(() => {
    return () => {
      edgeMaterial.dispose();
      selectedEdgeMaterial.dispose();
    };
  }, [edgeMaterial, selectedEdgeMaterial]);

  const weldBeadMat = isTech
    ? materialSet.weldBeadTechnical
    : config.sheetMaterial === 'inox'
      ? materialSet.weldBeadInox
      : materialSet.weldBeadGalvanized;

  const getAccessoryMaterial = (kind: AccessoryKind) => {
    switch (kind) {
      case 'end_cap':
        return activeMaterials;
      case 'bracket':
        return isTech ? materialSet.bracketTechnical : materialSet.bracketRealistic;
      case 'structural_flange':
        return isTech
          ? materialSet.structuralFlangeTechnical
          : materialSet.structuralFlangeRealistic;
      case 'lcct_frame':
        return isTech ? materialSet.lcctFrameTechnical : materialSet.lcctFrameRealistic;
      case 'lcct_mesh':
        return isTech ? materialSet.lcctWireMeshTechnical : materialSet.lcctWireMeshRealistic;
    }
  };

  const handleClickPart = (e: ThreeEvent<MouseEvent>, partCode: string) => {
    e.stopPropagation();
    onSelectPart(selectedPartCode === partCode ? null : partCode);
  };

  return (
    <group name="duct-assembly-root">
      {/* Main Sheet-Metal Duct Pieces (with fused integral end flanges & inner 1-A/1-B labels) */}
      {assembly.pieces.map((piece) => {
        const isSelected = selectedPartCode === piece.partCode;
        return (
          <group key={piece.id} name={`piece-${piece.partCode}`} position={piece.offset}>
            <mesh
              geometry={piece.geometry}
              material={activeMaterials}
              castShadow
              receiveShadow
              onClick={(e) => handleClickPart(e, piece.partCode)}
            />
            <lineSegments
              geometry={piece.edgesGeometry}
              material={isSelected ? selectedEdgeMaterial : edgeMaterial}
            />
            {showFaceLabels &&
              piece.faceLabels.map((lbl) => (
                <InnerFaceDecal
                  key={lbl.id}
                  label={lbl}
                  selected={isSelected}
                  onClickPart={handleClickPart}
                />
              ))}
          </group>
        );
      })}

      {/* Longitudinal Weld Beads */}
      {assembly.weldBeads.map((bead) => (
        <mesh
          key={bead.id}
          name={bead.id}
          geometry={bead.geometry}
          material={weldBeadMat}
          castShadow
        />
      ))}

      {/* Detached Stage 2 End Accessories (ke góc TDC/TDF, Bích V/U rời, LCCT screen, End Cap 1-E/1-F) */}
      {assembly.accessories.map((acc) => {
        const isSelected = Boolean(acc.partCode && selectedPartCode === acc.partCode);
        return (
          <group key={acc.id} name={acc.id} position={acc.offset}>
            <mesh
              geometry={acc.geometry}
              material={getAccessoryMaterial(acc.kind)}
              castShadow={acc.kind !== 'lcct_mesh'}
              receiveShadow
              onClick={
                acc.partCode
                  ? (e) => handleClickPart(e, acc.partCode!)
                  : undefined
              }
            />
            {acc.edgesGeometry && (
              <lineSegments
                geometry={acc.edgesGeometry}
                material={isSelected ? selectedEdgeMaterial : edgeMaterial}
              />
            )}
            {showFaceLabels &&
              acc.faceLabels &&
              acc.faceLabels.map((lbl) => (
                <InnerFaceDecal
                  key={lbl.id}
                  label={lbl}
                  selected={isSelected}
                  onClickPart={handleClickPart}
                />
              ))}
          </group>
        );
      })}
    </group>
  );
}
