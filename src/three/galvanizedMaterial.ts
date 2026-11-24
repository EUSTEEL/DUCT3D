import * as THREE from 'three';

export interface DuctMaterialSet {
  galvanizedMaterials: THREE.MeshStandardMaterial[];
  technicalMaterials: THREE.MeshStandardMaterial[];
  weldBeadGalvanized: THREE.MeshStandardMaterial;
  weldBeadTechnical: THREE.MeshStandardMaterial;
  dispose: () => void;
}

/**
 * Deterministic PRNG (Mulberry32) so procedural mini-spangle looks crisp & consistent.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates seamless tileable procedural canvas textures simulating authentic
 * mini-spangle galvanized sheet metal (tôn mạ kẽm hoa nhỏ):
 * - Albedo map: natural cool silvery-gray zinc tone with tiny crystalline facets & fine rolling streaks
 * - Roughness map: subtle micro-facet roughness variation (0.21–0.40) so crystals glint under studio softboxes
 * - Bump map: delicate zinc crystal boundary & dendrite micro-relief
 */
function createMiniSpangleTextures(size = 512): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const rand = mulberry32(20261123);

  // Toroidal Voronoi cell grid (42x42 tiny crystals over 280mm tile => ~6.5mm fine mini-spangle!)
  const gridN = 42;
  const totalCells = gridN * gridN;

  const seedX = new Float32Array(totalCells);
  const seedY = new Float32Array(totalCells);
  const cellAlbedo = new Float32Array(totalCells);
  const cellRoughness = new Float32Array(totalCells);
  const cellBump = new Float32Array(totalCells);
  const cellAngle = new Float32Array(totalCells);
  const cellTintBlue = new Float32Array(totalCells);

  for (let cy = 0; cy < gridN; cy++) {
    for (let cx = 0; cx < gridN; cx++) {
      const idx = cy * gridN + cx;
      // Slightly jittered cell center inside [cx, cx+1)
      seedX[idx] = cx + 0.14 + rand() * 0.72;
      seedY[idx] = cy + 0.14 + rand() * 0.72;

      // Cool silvery-gray spangle variation (natural galvanized steel, never blown-out white)
      const crystalBright = rand();
      cellAlbedo[idx] = 186 + crystalBright * 34; // ~186..220 luminance
      // Adjacent zinc dendrites have slightly different micro-roughness (0.20..0.41)
      cellRoughness[idx] = 0.20 + (1 - crystalBright) * 0.17 + (rand() - 0.5) * 0.05;
      cellBump[idx] = 112 + rand() * 34;
      cellAngle[idx] = rand() * Math.PI * 2;
      cellTintBlue[idx] = 6 + rand() * 7; // Subtle cool bluish-silver zinc cast
    }
  }

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const albedoCtx = albedoCanvas.getContext('2d')!;
  const albedoImg = albedoCtx.createImageData(size, size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext('2d')!;
  const roughImg = roughCtx.createImageData(size, size);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  const bumpImg = bumpCtx.createImageData(size, size);

  // Subtle horizontal cold-rolling micro-streak table (tileable along Y)
  const rollStreakY = new Float32Array(size);
  for (let y = 0; y < size; y++) {
    rollStreakY[y] =
      Math.sin((y / size) * Math.PI * 36) * 1.8 +
      Math.sin((y / size) * Math.PI * 94 + 1.3) * 1.1 +
      (rand() - 0.5) * 2.0;
  }

  const invSize = 1 / size;

  for (let py = 0; py < size; py++) {
    const gy = py * invSize * gridN;
    const baseCy = Math.floor(gy);
    const streak = rollStreakY[py];

    for (let px = 0; px < size; px++) {
      const gx = px * invSize * gridN;
      const baseCx = Math.floor(gx);

      let bestDistSq = 9999;
      let secondDistSq = 9999;
      let bestIdx = 0;
      let bestDx = 0;
      let bestDy = 0;

      // Search 3x3 toroidal neighborhood
      for (let oy = -1; oy <= 1; oy++) {
        let ny = baseCy + oy;
        let wrapY = 0;
        if (ny < 0) {
          ny += gridN;
          wrapY = -gridN;
        } else if (ny >= gridN) {
          ny -= gridN;
          wrapY = gridN;
        }
        const rowOff = ny * gridN;

        for (let ox = -1; ox <= 1; ox++) {
          let nx = baseCx + ox;
          let wrapX = 0;
          if (nx < 0) {
            nx += gridN;
            wrapX = -gridN;
          } else if (nx >= gridN) {
            nx -= gridN;
            wrapX = gridN;
          }

          const idx = rowOff + nx;
          const dx = gx - (seedX[idx] + wrapX);
          const dy = gy - (seedY[idx] + wrapY);
          const dSq = dx * dx + dy * dy;

          if (dSq < bestDistSq) {
            secondDistSq = bestDistSq;
            bestDistSq = dSq;
            bestIdx = idx;
            bestDx = dx;
            bestDy = dy;
          } else if (dSq < secondDistSq) {
            secondDistSq = dSq;
          }
        }
      }

      const d1 = Math.sqrt(bestDistSq);
      const d2 = Math.sqrt(secondDistSq);
      const edgeDist = d2 - d1; // 0 right at crystal boundary

      // Directional crystalline dendrite micro-sheen inside each zinc spangle
      const ang = cellAngle[bestIdx];
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const proj = bestDx * ca + bestDy * sa;
      const ortho = -bestDx * sa + bestDy * ca;
      const dendrite = Math.sin(proj * 19 + Math.cos(ortho * 11) * 1.4) * 4.2;

      // Subtle darker grain boundary groove between zinc crystals
      const boundaryFactor = edgeDist < 0.085 ? (0.085 - edgeDist) / 0.085 : 0;

      const baseLum = cellAlbedo[bestIdx] + dendrite + streak - boundaryFactor * 10.5;
      const blueCast = cellTintBlue[bestIdx];

      const r = Math.max(0, Math.min(255, Math.round(baseLum - blueCast * 0.55)));
      const g = Math.max(0, Math.min(255, Math.round(baseLum - blueCast * 0.12)));
      const b = Math.max(0, Math.min(255, Math.round(baseLum + blueCast * 0.65)));

      const roughVal = Math.max(
        0.18,
        Math.min(0.46, cellRoughness[bestIdx] + dendrite * 0.004 + boundaryFactor * 0.08)
      );
      const roughByte = Math.round(roughVal * 255);

      const bumpVal = Math.max(
        0,
        Math.min(
          255,
          Math.round(cellBump[bestIdx] + dendrite * 2.0 + streak * 1.5 - boundaryFactor * 32)
        )
      );

      const pOff = (py * size + px) * 4;
      albedoImg.data[pOff] = r;
      albedoImg.data[pOff + 1] = g;
      albedoImg.data[pOff + 2] = b;
      albedoImg.data[pOff + 3] = 255;

      roughImg.data[pOff] = roughByte;
      roughImg.data[pOff + 1] = roughByte;
      roughImg.data[pOff + 2] = roughByte;
      roughImg.data[pOff + 3] = 255;

      bumpImg.data[pOff] = bumpVal;
      bumpImg.data[pOff + 1] = bumpVal;
      bumpImg.data[pOff + 2] = bumpVal;
      bumpImg.data[pOff + 3] = 255;
    }
  }

  albedoCtx.putImageData(albedoImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);

  const configureTex = (canvas: HTMLCanvasElement, isColor: boolean): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  return {
    map: configureTex(albedoCanvas, true),
    roughnessMap: configureTex(roughCanvas, false),
    bumpMap: configureTex(bumpCanvas, false),
  };
}

/**
 * Creates both the realistic Mini-Spangle Galvanized material array and the
 * Technical Color Coding material array matching the 5 MaterialZone indices:
 * 0 = Body, 1 = Female Pittsburgh (Red), 2 = Male Pittsburgh (Blue),
 * 3 = 90° Bend Line (Green), 4 = Welded Seam (Amber-Orange).
 */
export function createDuctMaterialSet(): DuctMaterialSet {
  const { map, roughnessMap, bumpMap } = createMiniSpangleTextures(512);

  // Polygon offset ensures crisp <Edges> overlay never z-fights against thin sheet faces
  const commonOffset = {
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  };

  const makeGalv = (tint = '#eef3f8', rough = 1.0, metal = 0.83) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(tint),
      map,
      roughnessMap,
      bumpMap,
      bumpScale: 0.00075,
      metalness: metal,
      roughness: rough,
      envMapIntensity: 1.22,
      ...commonOffset,
    });

  // In Galvanized mode, all sheet zones share natural cool mini-spangle steel
  const galvMain = makeGalv('#edf2f7', 1.0, 0.83);
  const galvWeldZone = makeGalv('#e3ebf2', 1.0, 0.80);

  const galvanizedMaterials: THREE.MeshStandardMaterial[] = [
    galvMain, // 0: Body
    galvMain, // 1: Female seam
    galvMain, // 2: Male seam
    galvMain, // 3: Bend line
    galvWeldZone, // 4: Weld seam zone
  ];

  // In Technical Color mode, keep a slight metallic sheen + micro-bump so folds stay legible in 3D
  const makeTech = (hex: string, metalness = 0.25, roughness = 0.42) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      bumpMap,
      bumpScale: 0.0003,
      metalness,
      roughness,
      envMapIntensity: 0.85,
      ...commonOffset,
    });

  const technicalMaterials: THREE.MeshStandardMaterial[] = [
    makeTech('#9eb0c4', 0.35, 0.44), // 0: Body sheet (cool neutral steel gray)
    makeTech('#e13f3f', 0.22, 0.36), // 1: Mí kép Female (Đỏ)
    makeTech('#2f7cf6', 0.22, 0.36), // 2: Mí đơn Male (Xanh dương)
    makeTech('#22c55e', 0.20, 0.38), // 3: Đường chấn 90° (Xanh lá)
    makeTech('#f59e0b', 0.24, 0.36), // 4: Mí hàn (Cam / Hổ phách)
  ];

  const weldBeadGalvanized = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9fb2c7'),
    metalness: 0.86,
    roughness: 0.38,
    envMapIntensity: 1.1,
  });

  const weldBeadTechnical = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fbbf24'),
    metalness: 0.3,
    roughness: 0.35,
    envMapIntensity: 0.9,
  });

  const dispose = () => {
    map.dispose();
    roughnessMap.dispose();
    bumpMap.dispose();
    galvMain.dispose();
    galvWeldZone.dispose();
    technicalMaterials.forEach((m) => m.dispose());
    weldBeadGalvanized.dispose();
    weldBeadTechnical.dispose();
  };

  return {
    galvanizedMaterials,
    technicalMaterials,
    weldBeadGalvanized,
    weldBeadTechnical,
    dispose,
  };
}
