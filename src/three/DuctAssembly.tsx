import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildDuctAssembly } from '../domain/sheetProfileBuilder';
import type { DuctConfig } from '../types/duct';
import { createDuctMaterialSet } from './galvanizedMaterial';

interface DuctAssemblyProps {
  config: DuctConfig;
}

/**
 * Renders the parametric 3D straight duct assembly with smooth animation between
 * Chưa gò mí ↔ Đã gò mí, crisp fine mechanical edge lines, and real multi-material groups.
 * Zero 3D text annotations inside the duct or on seam folds.
 */
export function DuctAssembly({ config }: DuctAssemblyProps) {
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
    stiffenerRibs,
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
      seamState: renderedSeamProgress >= 0.5 ? 'seamed' : 'unseamed',
      explode: explodeRatio * 100,
      stiffenerRibs,
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
    stiffenerRibs,
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
    };
  }, [assembly]);

  const activeMaterials =
    config.materialMode === 'technical'
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

  useEffect(() => {
    return () => {
      edgeMaterial.dispose();
    };
  }, [edgeMaterial]);

  const weldBeadMat =
    config.materialMode === 'technical'
      ? materialSet.weldBeadTechnical
      : config.sheetMaterial === 'inox'
        ? materialSet.weldBeadInox
        : materialSet.weldBeadGalvanized;

  return (
    <group name="duct-assembly-root">
      {assembly.pieces.map((piece) => (
        <group key={piece.id} name={`piece-${piece.id}`} position={piece.offset}>
          <mesh
            geometry={piece.geometry}
            material={activeMaterials}
            castShadow
            receiveShadow
          />
          <lineSegments geometry={piece.edgesGeometry} material={edgeMaterial} />
        </group>
      ))}

      {assembly.weldBeads.map((bead) => (
        <mesh
          key={bead.id}
          name={bead.id}
          geometry={bead.geometry}
          material={weldBeadMat}
          castShadow
        />
      ))}
    </group>
  );
}
