import * as THREE from 'three';

export interface DuctMaterialSet {
  galvanizedMaterials: THREE.MeshStandardMaterial[];
  inoxMaterials: THREE.MeshStandardMaterial[];
  technicalMaterials: THREE.MeshStandardMaterial[];
  weldBeadGalvanized: THREE.MeshStandardMaterial;
  weldBeadInox: THREE.MeshStandardMaterial;
  weldBeadTechnical: THREE.MeshStandardMaterial;
  bracketRealistic: THREE.MeshStandardMaterial;
  bracketTechnical: THREE.MeshStandardMaterial;
  structuralFlangeRealistic: THREE.MeshStandardMaterial;
  structuralFlangeTechnical: THREE.MeshStandardMaterial;
  lcctFrameRealistic: THREE.MeshStandardMaterial;
  lcctFrameTechnical: THREE.MeshStandardMaterial;
  lcctWireMeshRealistic: THREE.MeshStandardMaterial;
  lcctWireMeshTechnical: THREE.MeshStandardMaterial;
  dispose: () => void;
}

/**
 * Deterministic PRNG (Mulberry32) so procedural metallic finishes look crisp & consistent.
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

function configureCanvasTexture(canvas: HTMLCanvasElement, isColor: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates seamless tileable procedural canvas textures simulating authentic
 * mini-spangle galvanized sheet metal (tôn mạ kẽm hoa nhỏ):
 * - Albedo map: natural cool silvery-gray zinc tone with tiny crystalline facets & fine rolling streaks
 * - Roughness map: subtle micro-facet roughness variation (0.20–0.41) so crystals glint under studio softboxes
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
      seedX[idx] = cx + 0.14 + rand() * 0.72;
      seedY[idx] = cy + 0.14 + rand() * 0.72;

      const crystalBright = rand();
      cellAlbedo[idx] = 186 + crystalBright * 34;
      cellRoughness[idx] = 0.2 + (1 - crystalBright) * 0.17 + (rand() - 0.5) * 0.05;
      cellBump[idx] = 112 + rand() * 34;
      cellAngle[idx] = rand() * Math.PI * 2;
      cellTintBlue[idx] = 6 + rand() * 7;
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
      const edgeDist = d2 - d1;

      const ang = cellAngle[bestIdx];
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const proj = bestDx * ca + bestDy * sa;
      const ortho = -bestDx * sa + bestDy * ca;
      const dendrite = Math.sin(proj * 19 + Math.cos(ortho * 11) * 1.4) * 4.2;

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

  return {
    map: configureCanvasTexture(albedoCanvas, true),
    roughnessMap: configureCanvasTexture(roughCanvas, false),
    bumpMap: configureCanvasTexture(bumpCanvas, false),
  };
}

/**
 * Generates seamless tileable procedural canvas textures simulating authentic
 * brushed stainless steel (Inox 304 hairline / No.4 finish — ZERO zinc spangles):
 * - Albedo map: bright, silky neutral-cool stainless sheen with fine continuous longitudinal hairlines
 * - Roughness map: smooth polished finish (0.14–0.24) with fine directional brush variation
 * - Bump map: ultra-delicate hairline micro-grooves
 */
function createBrushedInoxTextures(size = 512): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const rand = mulberry32(3042026);

  // Precompute tileable hairline rows along X (UV.u runs across cross-section, UV.v runs along duct length L)
  // Running brushed hairlines along V (longitudinal axis) matches rolled stainless coil sheet!
  const colBase = new Float32Array(size);
  const colRough = new Float32Array(size);
  const colPhase = new Float32Array(size);
  const colFreq = new Float32Array(size);

  // Smooth multi-frequency base across X + crisp hairline micro-scratches
  for (let x = 0; x < size; x++) {
    const t = (x / size) * Math.PI * 2;
    const broadBand =
      Math.sin(t * 5) * 2.0 +
      Math.sin(t * 13 + 0.9) * 1.4 +
      Math.sin(t * 29 + 2.1) * 1.0;
    const fineLine = (rand() - 0.5) * 10.5;
    colBase[x] = 240 + broadBand + fineLine;
    colRough[x] = 0.245 + (rand() - 0.5) * 0.055;
    colPhase[x] = rand() * Math.PI * 2;
    colFreq[x] = 1 + Math.floor(rand() * 3); // Strictly integer for 100% seamless V wrap
  }

  // Slight horizontal 3-tap softening of raw noise so hairlines look silky, not pixel-noisy
  const smoothColBase = new Float32Array(size);
  const smoothColRough = new Float32Array(size);
  for (let x = 0; x < size; x++) {
    const xm = (x - 1 + size) % size;
    const xp = (x + 1) % size;
    smoothColBase[x] = colBase[xm] * 0.22 + colBase[x] * 0.56 + colBase[xp] * 0.22;
    smoothColRough[x] = colRough[xm] * 0.25 + colRough[x] * 0.5 + colRough[xp] * 0.25;
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

  for (let py = 0; py < size; py++) {
    const vRad = (py / size) * Math.PI * 2;
    for (let px = 0; px < size; px++) {
      // Gentle longitudinal modulation along each hairline stroke (100% tileable)
      const strokeMod = Math.sin(vRad * colFreq[px] + colPhase[px]) * 2.2;
      const micro = (rand() - 0.5) * 1.2;
      const lum = smoothColBase[px] + strokeMod + micro;

      // Bright clean stainless steel hue (neutral bright silver-platinum)
      const r = Math.max(0, Math.min(255, Math.round(lum + 1)));
      const g = Math.max(0, Math.min(255, Math.round(lum + 2)));
      const b = Math.max(0, Math.min(255, Math.round(lum + 3)));

      const roughVal = Math.max(
        0.2,
        Math.min(0.31, smoothColRough[px] - strokeMod * 0.003)
      );
      const roughByte = Math.round(roughVal * 255);

      const bumpVal = Math.max(
        0,
        Math.min(255, Math.round(128 + (smoothColBase[px] - 240) * 3.6 + strokeMod * 1.8))
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

  return {
    map: configureCanvasTexture(albedoCanvas, true),
    roughnessMap: configureCanvasTexture(roughCanvas, false),
    bumpMap: configureCanvasTexture(bumpCanvas, false),
  };
}

function createWireMeshTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const cells = 4;
  const step = size / cells;

  // Draw crisp woven metallic wire grid with slight specular center stripe
  for (let i = 0; i <= cells; i++) {
    const pos = Math.round(i * step);
    ctx.fillStyle = 'rgba(186, 200, 214, 0.92)';
    ctx.fillRect(pos - 2, 0, 4, size);
    ctx.fillRect(0, pos - 2, size, 4);

    ctx.fillStyle = 'rgba(235, 243, 250, 0.98)';
    ctx.fillRect(pos - 1, 0, 1.5, size);
    ctx.fillRect(0, pos - 1, size, 1.5);
  }

  return configureCanvasTexture(canvas, true);
}

/**
 * Creates Galvanized Mini-Spangle, Brushed Stainless Inox, and Technical Color Coding material sets
 * matching the 6 MaterialZone indices:
 * 0 = Body, 1 = Female Pittsburgh (Red), 2 = Male Pittsburgh (Blue),
 * 3 = 90° Bend Line (Green), 4 = Welded Seam (Orange), 5 = End Flange (Yellow).
 */
export function createDuctMaterialSet(): DuctMaterialSet {
  const galvTex = createMiniSpangleTextures(512);
  const inoxTex = createBrushedInoxTextures(512);
  const wireMeshTex = createWireMeshTexture(128);

  // Polygon offset ensures crisp <Edges> overlay never z-fights against thin sheet faces
  const commonOffset = {
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  };

  // 1. Tôn Mạ Kẽm hoa nhỏ (mini-spangle)
  const makeGalv = (tint = '#eef3f8', rough = 1.0, metal = 0.83) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(tint),
      map: galvTex.map,
      roughnessMap: galvTex.roughnessMap,
      bumpMap: galvTex.bumpMap,
      bumpScale: 0.00075,
      metalness: metal,
      roughness: rough,
      envMapIntensity: 1.22,
      ...commonOffset,
    });

  const galvMain = makeGalv('#edf2f7', 1.0, 0.83);
  const galvWeldZone = makeGalv('#e3ebf2', 1.0, 0.8);

  const galvanizedMaterials: THREE.MeshStandardMaterial[] = [
    galvMain, // 0: Body
    galvMain, // 1: Female seam
    galvMain, // 2: Male seam
    galvMain, // 3: Bend line
    galvWeldZone, // 4: Weld seam
    galvMain, // 5: Integral end flange (same galvanized sheet!)
  ];

  // 2. Inox xước sáng mịn (brushed stainless steel, bright satin finish, no zinc spangle)
  const makeInox = (tint = '#fbfdff', rough = 1.0, metal = 0.78) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(tint),
      map: inoxTex.map,
      roughnessMap: inoxTex.roughnessMap,
      bumpMap: inoxTex.bumpMap,
      bumpScale: 0.00028,
      metalness: metal,
      roughness: rough,
      envMapIntensity: 1.62,
      ...commonOffset,
    });

  const inoxMain = makeInox('#fbfdff', 1.0, 0.78);
  const inoxWeldZone = makeInox('#eef3f8', 1.0, 0.76);

  const inoxMaterials: THREE.MeshStandardMaterial[] = [
    inoxMain, // 0: Body
    inoxMain, // 1: Female seam
    inoxMain, // 2: Male seam
    inoxMain, // 3: Bend line
    inoxWeldZone, // 4: Weld seam
    inoxMain, // 5: Integral end flange (same brushed Inox!)
  ];

  // 3. Tô màu kỹ thuật (Đỏ = Mí kép, Xanh dương = Mí đơn, Xanh lá = Đường chấn, Cam = Mí hàn, Vàng = Bích)
  const makeTech = (hex: string, metalness = 0.25, roughness = 0.42) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      bumpMap: galvTex.bumpMap,
      bumpScale: 0.0003,
      metalness,
      roughness,
      envMapIntensity: 0.85,
      ...commonOffset,
    });

  const technicalMaterials: THREE.MeshStandardMaterial[] = [
    makeTech('#9eb0c4', 0.35, 0.44), // 0: Body sheet
    makeTech('#e13f3f', 0.22, 0.36), // 1: Mí kép Female (Đỏ)
    makeTech('#2f7cf6', 0.22, 0.36), // 2: Mí đơn Male (Xanh dương)
    makeTech('#22c55e', 0.20, 0.38), // 3: Đường chấn 90° (Xanh lá)
    makeTech('#f97316', 0.24, 0.36), // 4: Mí hàn (Cam đậm)
    makeTech('#eab308', 0.24, 0.36), // 5: Bích kết nối (Vàng nổi bật)
  ];

  const weldBeadGalvanized = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9fb2c7'),
    metalness: 0.86,
    roughness: 0.38,
    envMapIntensity: 1.1,
  });

  const weldBeadInox = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c8d4e0'),
    metalness: 0.92,
    roughness: 0.26,
    envMapIntensity: 1.3,
  });

  const weldBeadTechnical = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fb923c'),
    metalness: 0.3,
    roughness: 0.35,
    envMapIntensity: 0.9,
  });

  // Stamped galvanized steel TDC corner brackets & C-cleat bars
  const bracketRealistic = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d3dde8'),
    roughnessMap: inoxTex.roughnessMap,
    metalness: 0.84,
    roughness: 0.32,
    envMapIntensity: 1.35,
    ...commonOffset,
  });

  const bracketTechnical = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#facc15'),
    metalness: 0.28,
    roughness: 0.35,
    envMapIntensity: 0.95,
    ...commonOffset,
  });

  // Detached structural steel Bích V / Bích U frames (gunmetal zinc-coated structural angle/channel)
  const structuralFlangeRealistic = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9aa8b8'),
    roughnessMap: galvTex.roughnessMap,
    bumpMap: galvTex.bumpMap,
    bumpScale: 0.0005,
    metalness: 0.80,
    roughness: 0.44,
    envMapIntensity: 1.18,
    ...commonOffset,
  });

  const structuralFlangeTechnical = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#eab308'),
    metalness: 0.25,
    roughness: 0.38,
    envMapIntensity: 0.9,
    ...commonOffset,
  });

  // LCCT Screen frame & see-through square wire mesh
  const lcctFrameRealistic = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c5d1de'),
    metalness: 0.82,
    roughness: 0.34,
    envMapIntensity: 1.25,
    ...commonOffset,
  });

  const lcctFrameTechnical = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fde047'),
    metalness: 0.25,
    roughness: 0.38,
    envMapIntensity: 0.9,
    ...commonOffset,
  });

  const lcctWireMeshRealistic = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dbe5f0'),
    map: wireMeshTex,
    transparent: true,
    alphaTest: 0.2,
    metalness: 0.78,
    roughness: 0.32,
    side: THREE.DoubleSide,
    envMapIntensity: 1.3,
  });

  const lcctWireMeshTechnical = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fef08a'),
    map: wireMeshTex,
    transparent: true,
    alphaTest: 0.2,
    metalness: 0.2,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });

  const dispose = () => {
    galvTex.map.dispose();
    galvTex.roughnessMap.dispose();
    galvTex.bumpMap.dispose();
    inoxTex.map.dispose();
    inoxTex.roughnessMap.dispose();
    inoxTex.bumpMap.dispose();
    wireMeshTex.dispose();
    galvMain.dispose();
    galvWeldZone.dispose();
    inoxMain.dispose();
    inoxWeldZone.dispose();
    technicalMaterials.forEach((m) => m.dispose());
    weldBeadGalvanized.dispose();
    weldBeadInox.dispose();
    weldBeadTechnical.dispose();
    bracketRealistic.dispose();
    bracketTechnical.dispose();
    structuralFlangeRealistic.dispose();
    structuralFlangeTechnical.dispose();
    lcctFrameRealistic.dispose();
    lcctFrameTechnical.dispose();
    lcctWireMeshRealistic.dispose();
    lcctWireMeshTechnical.dispose();
  };

  return {
    galvanizedMaterials,
    inoxMaterials,
    technicalMaterials,
    weldBeadGalvanized,
    weldBeadInox,
    weldBeadTechnical,
    bracketRealistic,
    bracketTechnical,
    structuralFlangeRealistic,
    structuralFlangeTechnical,
    lcctFrameRealistic,
    lcctFrameTechnical,
    lcctWireMeshRealistic,
    lcctWireMeshTechnical,
    dispose,
  };
}
