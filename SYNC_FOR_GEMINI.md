# EUSTEEL DUCT3D — Tài Liệu Đồng Bộ Trạng Thái Chuẩn (`SYNC_FOR_GEMINI.md`)

> **Nguồn sự thật:** Đọc trực tiếp từ mã nguồn thực tế trên nhánh `main` sau **Bước 2: Tái cấu trúc 3 lớp cắm–rút (`core` / `products` / `addons`) + Cây Menu 7 nhóm + Việt hóa toàn bộ nhãn giao diện**, đối chiếu cùng `git log` và `REF_NOTES.md`.
> **Phạm vi hiện tại:** Kiến trúc 3 lớp cắm–rút sạch + **Ống vuông thẳng** hoàn thiện đầy đủ (3D cấu tạo thực tế xưởng, Mở phôi 3D 60fps, Ghép mảnh tự do 4–5–6 mặt, Trải phẳng 2D & Xuất DXF chuẩn AutoCAD 2021 / Bodor Thinker 3.0) + Menu cây 7 nhóm sản phẩm (1 sẵn sàng, 19 mục `Chặng sau`) + khung kiểu mở rộng chờ cho `face-features` & `insulation-ei`. Chưa dựng hình học lỗ trổ/chân rẽ/tyren/lớp bọc bảo ôn hay phụ kiện mới.

---

## 1. Cấu trúc dự án hiện tại

### Thư mục gốc & `docs/`
- `README.md` — Giới thiệu nhanh dự án & lệnh chạy/build.
- `SPEC_MODULE_1.md` — Đặc tả chi tiết Ống vuông thẳng (Chặng 1 → Chặng 3).
- `REF_NOTES.md` — Sổ tay đối chiếu hình học thực tế từ 50 ảnh chụp xưởng & bản vẽ mẫu (Đợt 1).
- `SYNC_FOR_GEMINI.md` — File đồng bộ trạng thái chuẩn hiện tại (tài liệu này).
- `docs/ARCHITECTURE.md` — Kiến trúc 3 lớp cắm–rút, cây Menu 7 nhóm sản phẩm & quy ước nhãn tiếng Việt.
- `docs/01_SPEC_CORE.md` — Quy chuẩn lõi kỹ thuật dùng chung (vật liệu, bích, mí, FoldGraph, 2D & DXF).

### Cây thư mục `src/` (Kiến trúc 3 lớp)
```text
src/
├── main.tsx                                    # Điểm khởi chạy React 19 gắn vào #root
├── App.tsx                                     # Điều phối activeProduct, DuctConfig, WorkshopSettings, 3D/2D viewport, Ghép tự do & Toast
├── index.css                                   # Tailwind CSS v4 + nền studio 3D/2D, scrollbar và slider tùy biến
├── core/                                       # LÕI DÙNG CHUNG (mọi sản phẩm chỉ import một chiều từ đây)
│   ├── constants.ts                            # Hằng số hình học lõi (MM_TO_M = 0.001)
│   ├── types/
│   │   ├── duct.ts                             # Kiểu dữ liệu ống, vật liệu, đầu kết nối, FoldEdgeId, WorkshopSettings, SelectionTarget
│   │   ├── flatPattern2d.ts                    # Kiểu dữ liệu bản vẽ 2D phẳng mở (EditableContour2D, Dimension2D, OverlapRect2D)
│   │   └── product.ts                          # Kiểu ProductGroupId (7 nhóm), ProductStatus, ProductCapabilities, ProductDefinition
│   ├── rules/
│   │   ├── workshopSettings.ts                 # Hằng số & lưu/đọc localStorage (eusteel_duct3d_workshop_settings_v1) cho Cài đặt xưởng
│   │   ├── ductRules.ts                        # Vật liệu, nhãn tiếng Việt chuẩn (END_LABELS, CORNER_SHORT_LABELS), chia mảnh, gân, S Phôi & LSX
│   │   └── endConnectionRules.ts               # Quy tắc bù phôi (+mm), khấu góc, kích thước 9 loại đầu kết nối
│   ├── foldGraph/
│   │   └── foldGraph.ts                        # Đồ thị Mặt–Cạnh 4/5/6 mặt, tự mở mí vòng kín, nhãn tiếng Việt chuẩn cho mặt & cạnh
│   ├── flanges/
│   │   └── endConnectionBuilder.ts             # Dựng mesh 3D chi tiết rời (4 ke góc TDC, Bích V/U rời, khung lưới LCCT, mảnh bịt rời)
│   ├── export/
│   │   ├── dxfExporter.ts                      # Xuất ASCII DXF chuẩn AutoCAD 2021 (AC1021) & Bodor Thinker (2 layer CUT + DIM)
│   │   └── flatPatternSvgExport.ts             # Tiện ích path & tạo bản in/lưu PDF từ SVG chạy ngầm
│   ├── materials/
│   │   ├── galvanizedMaterial.ts               # Vật liệu PBR procedural: Tôn Mạ Kẽm hoa nhỏ, Inox & 6 vùng Tô màu kỹ thuật
│   │   └── faceLabelTexture.ts                 # Texture nhãn đánh dấu lòng trong 1-A, 1-B... (canvas decal)
│   ├── scene/
│   │   ├── sceneContext.ts                     # React Context chia sẻ thao tác chuột phải an toàn cho các 3D product assembly
│   │   └── DuctScene.tsx                       # Canvas Three.js, ánh sáng HDRI, Grid/ContactShadows, OrbitControls & Right-drag Pan
│   └── ui/
│       ├── LeftSidebar.tsx                     # Khung cột trái 320px: Brand + ProductSelector + 3 tab (Thông số | Nhập LSX | S Phôi)
│       ├── ProductSelector.tsx                 # Menu chọn sản phẩm dạng cây 7 nhóm đọc tự động từ products/registry.ts
│       ├── TopToolbar.tsx                      # Thanh công cụ viewport đọc capabilities (3D/2D/Song song, vật liệu, gò mí, Tách mảnh, Mở phôi 3D)
│       ├── ViewportOverlays.tsx                # Nút mở lại sidebar, thẻ đối tượng đang chọn, chú giải màu, thanh trạng thái & preset camera
│       ├── FlatPattern2DViewer.tsx             # Trình xem 2D cắm-rút (Zoom/Pan, chọn 2 chiều, Tải file DXF theo dxfSupported, In/Lưu PDF)
│       ├── SelectionContextUI.tsx              # Menu chuột phải (Context Menu) & Thẻ chỉnh nhanh nổi (Floating Inspector)
│       ├── EndConnectionPanel.tsx              # Bảng chọn đầy đủ 9 loại đầu kết nối (Kết nối 1 / Kết nối 2) & thông số riêng
│       ├── WorkshopSettingsModal.tsx           # Popup Cài đặt xưởng (khổ lăn gân, bước gân, khổ tấm Tôn/Inox)
│       └── NumericDraftInput.tsx               # Ô nhập số cho phép gõ tay tự do, xóa trắng, Enter/Blur xác nhận và kẹp min/max
├── products/                                   # CÁC SẢN PHẨM CẮM–RÚT
│   ├── registry.ts                             # Sổ đăng ký trung tâm 7 nhóm sản phẩm (20 mục) & cờ capabilities
│   └── ong-vuong-thang/                        # Sản phẩm đang chạy: Ống vuông thẳng
│       ├── index.ts                            # Đăng ký ONG_VUONG_THANG_PRODUCT & re-export module
│       ├── geometry3D.ts                       # Hệ bản lề 6 mặt 60fps (Mở phôi 3D, Tách mảnh, mí kép 6 đoạn, Nẹp C 180°, ke/bích)
│       ├── flatPattern2D.ts                    # Trải phẳng 2D (tuyến tính, mảnh bịt rời, cây ghép tự do Euler-Tour) & kiểm tra chồng lấn
│       ├── DuctAssembly.tsx                    # Render cây bản lề 3D & phụ kiện, cập nhật 60fps không rebuild geometry
│       └── ui/
│           ├── ParamsTab.tsx                   # Tab Thông số: Preset, W/H/L, vật liệu/độ dày, Kết nối 1/2, chia mảnh + Ghép tự do 2×2, mí, gân
│           ├── LsxTab.tsx                      # Tab Nhập LSX nhanh bằng chuỗi tiếng Việt + sao chép/nhập JSON cấu hình
│           └── BlankAnalysisTab.tsx            # Tab S Phôi: tính tổng diện tích m² (tuyệt đối không kg), L phôi, kiểm tra khổ & bảng mảnh
└── addons/                                     # KHUNG MỞ RỘNG CHỜ CHẶNG SAU (chưa dựng hình học)
    ├── face-features/
    │   └── index.ts                            # Kiểu nền chờ cho lỗ trổ, chân rẽ, cổ nối, cửa thăm, tai treo, tyren, thanh V tăng cứng...
    └── insulation-ei/
        └── index.ts                            # Kiểu nền chờ cho tấm bọc chống cháy EI, xốp PE, bông thủy tinh, vỏ bọc tôn...
```

### Cây Menu sản phẩm 7 nhóm (`src/products/registry.ts`, không hiển thị mã M1–M5)
1. **Ống thẳng:** `Ống vuông thẳng` *(Sẵn sàng — mặc định)*
2. **Côn thu:** `Côn thu vuông - vuông`, `Côn thu vuông - tròn`, `Côn thu vuông - tròn EI` *(Chặng sau)*
3. **Cút vuông:** `Cút vuông` *(gộp 90°, 45°, lẻ độ vào thông số góc)*, `Cút vuông EI` *(Chặng sau)*
4. **Z vuông:** `Z vuông`, `Z lượn tròn` *(Chặng sau)*
5. **Tê & Chạc:** `Tê vuông`, `Chạc 3`, `Chạc 4`, `Tê / Chạc EI` *(Chặng sau)*
6. **Hộp gió:** `Hộp gió / Máng`, `Hộp đầu máy` *(Chặng sau)*
7. **Ống & Phụ kiện tròn:** `Ống tròn trơn`, `Ống tròn xoắn`, `Cút tròn`, `Côn tròn`, `Z tròn`, `Tê / Chạc tròn` *(Chặng sau)*

### Thư viện & Công cụ cốt lõi (`package.json`)
- **UI & Build:** `react` `^19.3.1`, `react-dom` `^19.3.1`, `typescript` `~7.0.2`, `vite` `^8.3.6`, `tailwindcss` `^4.3.5` (`@tailwindcss/vite`), `lucide-react` `^1.79.0`, `oxlint` `^1.90.0`.
- **3D Engine:** `three` `^0.187.0`, `@react-three/fiber` `^9.8.2`, `@react-three/drei` `^10.7.9`.
- **CAD / DXF:** `@tarikjabiri/dxf` `^2.10.1`.

---

## 2. Thông số vật liệu, máy móc & kiểm tra khổ

### Vật liệu, khổ tấm chuẩn & độ dày (`src/core/types/duct.ts`, `src/core/rules/ductRules.ts`, `src/core/rules/workshopSettings.ts`)
| Vật liệu (`SheetMaterialType`) | Nhãn giao diện | Khổ tấm chuẩn mặc định | Các độ dày chuẩn (mm) | Mặc định |
| :--- | :--- | :---: | :--- | :---: |
| `galvanized` | `Tôn Mạ Kẽm` | **`1200 × 6000 mm`** | `0.58`, `0.75`, `0.95`, `1.15`, `1.2`, `1.5` | **`0.75 mm`** |
| `inox` | `Inox` | **`1250 × 6000 mm`** | `0.6`, `0.8`, `1.0` | **`0.8 mm`** |

- **Kích thước ống mặc định (`DEFAULT_DUCT_CONFIG`):** `W = 500 mm`, `H = 320 mm`, `L = 1100 mm`, `Tôn Mạ Kẽm 0.75 mm`, 2 đầu `TDC/TDF`, `1 mảnh (O)`, `Mí gò Pittsburgh`, `Đã gò mí`, `Gân tăng cứng BẬT`, `Nhãn mặt BẬT`.

### Quy tắc tính `S Phôi` (`src/core/rules/ductRules.ts` & `src/products/ong-vuong-thang/ui/BlankAnalysisTab.tsx`)
- **Chỉ tính diện tích (`m²`), TUYỆT ĐỐI không tính hoặc hiển thị khối lượng (`kg`).**
- Công thức cho từng mảnh:
  - `L_phôi` (thân ống) = `L + bù Kết nối 1 + bù Kết nối 2` (lấy `max` bù phôi theo các mặt thuộc mảnh).
  - `B_phôi` (chiều rộng triển khai) = tổng bề rộng các mặt thuộc mảnh + phụ cấp mí 2 đầu biên (riêng mảnh ghép tự do hoặc khi có bản 2D thì đồng bộ trực tiếp theo đúng khung bao `widthMm × heightMm` từ `FlatPatternDocument`).
  - `areaM2 = (B_phôi / 1000) × (L_phôi / 1000)`; **Tổng S phôi** = tổng `areaM2` của mọi mảnh (gồm cả mảnh bịt rời hoặc mảnh gộp tự do).

### Logic kiểm tra lọt khổ tấm (xoay `0° / 90°`) (`evaluateSheetLimit` & `evaluateCutOrientation`)
Với mỗi mảnh có kích thước bao `(B_phôi, L_phôi)` và khổ tấm `(W_tấm, L_tấm)`:
1. **Cắt ngang khổ (`ngang_chuan`, `0°` — `ĐẠT` xanh):** `L_phôi ≤ W_tấm` **VÀ** `B_phôi ≤ L_tấm`.
2. **Xoay dọc tấm (`doc_6000`, `90°` — `ĐẠT` xanh):** `B_phôi ≤ W_tấm` **VÀ** `L_phôi ≤ L_tấm`.
3. **Vượt khổ (`vuot_kho` / `can_noi_c` — `ĐỎ`):** không thỏa cả hai hướng trên (tức `min(B_phôi, L_phôi) > W_tấm` hoặc `max(B_phôi, L_phôi) > L_tấm`) → yêu cầu chia mảnh hoặc **Nối C (`17 + 17 mm`)**.

- **Đề xuất chia mảnh tự động (`evaluateSplitRecommendation`):**
  - Nếu `L_phôi ≤ W_tấm`: chu vi `2*(W+H) ≤ 2400 mm` → `1 mảnh (O)`; `> 2400 mm` & `(W+H) ≤ 3000 mm` → `2 mảnh L`; `(W+H) > 3000 mm` → `4 mảnh rời`.
  - Nếu `L_phôi > W_tấm` nhưng `≤ L_tấm`: lần lượt kiểm tra xoay dọc `90°` cho `1 mảnh` (`2*(W+H)+38 ≤ W_tấm`) → `2 mảnh L` (`W+H+38 ≤ W_tấm`) → `4 mảnh` (`max(W,H)+62 ≤ W_tấm`); nếu vẫn vượt thì đề xuất `4 mảnh` kèm Nối C.

### Gân tăng cứng & Máy lăn gân (`computeRibLayout`, `flatPattern2D.ts`, `workshopSettings.ts`)
- **Chỉ 1 dạng gân thẳng** (dập lồi ra mặt ngoài 3D), **LUÔN chạy song song 2 đầu bích `Kết nối 1` & `Kết nối 2`** (chạy ngang theo trục triển khai trên bản 2D, vuông góc trục dài `L`). Với mảnh bịt rời, gân chạy song song cạnh dài (`W ≥ H` thì song song trục `W`).
- **Hằng số bố trí gân:** bước mặc định `STIFFENER_RIB_PITCH_MM = 210 mm`, khoảng hở 2 đầu tối thiểu `STIFFENER_RIB_MIN_END_CLEARANCE_MM = 90 mm`, chỉ sinh gân khi `enabled && L ≥ 220 mm`; phân bố đối xứng qua tâm với số gân `count = max(1, floor((L - 180) / pitchMm) + 1)`.
- **Kiểm tra khổ máy lăn gân:** kiểm tra theo **chiều vuông góc với đường gân** (`rollCheckSpanMm` = `L_phôi` với mảnh thân ống; chiều vuông góc gân của mảnh bịt). Nếu `hasRibs && rollCheckSpanMm > rollFormerLimitMm` → cảnh báo vàng (`warn`) kể cả khi lọt khổ tấm.

### Các thông số trong popup `Cài đặt xưởng` (`WorkshopSettingsModal.tsx`, lưu `localStorage` key `eusteel_duct3d_workshop_settings_v1`)
| Thông số (`WorkshopSettings`) | Mặc định | Giới hạn (min – max) |
| :--- | :---: | :---: |
| `rollFormerLimitMm` — Khổ máy lăn gân tối đa | **`1900 mm`** | `600 – 4000 mm` |
| `ribPitchMm` — Khoảng cách bước gân tăng cứng | **`210 mm`** | `80 – 600 mm` |
| `galvanizedSheetW × galvanizedSheetL` — Khổ Tôn Mạ Kẽm | **`1200 × 6000 mm`** | `500–3000 × 1000–12000 mm` |
| `inoxSheetW × inoxSheetL` — Khổ Inox | **`1250 × 6000 mm`** | `500–3000 × 1000–12000 mm` |

---

## 3. Thư viện Đầu kết nối (`Kết nối 1` / `Kết nối 2`) & Mí ghép

### A. 9 loại Đầu kết nối (`EndConnectionType` — ID nội bộ `c1`/`c2`, hiển thị UI là `Kết nối 1 (Trước)` và `Kết nối 2 (Sau)`)
| Loại (`type`) | Phân loại | Bù phôi thân (+mm) | Khấu mí vào thân (`getSeamNotchDepthIntoBody`) | Quy cách 3D / 2D thực tế trong code |
| :--- | :---: | :---: | :---: | :--- |
| **`tdc_tdf`** (`TDC/TDF`) | Liền thân | **`+48`** | **`12 mm`** (khấu tổng `60 mm`) | Cao bích 3D `32 mm` (`l1=31.5`, `l2=9.4`, `l3=7.8`, `l4=3.0` cuốn J-hook), có gân giật bậc giữa mặt bích, 4 ke góc rời mạ kẽm đồng mặt phẳng lỗ giọt nước. 2D: bậc khấu 90° sắc nét + bậc chuyển `~1.5 mm`, khe bẻ giữa các mặt song song rộng **`2 mm`** (`slotHalf = 1 mm`) kết mũi V nhỏ. Tùy chọn `showEndIndent` (mặc định TẮT): vết V lõm cạnh bên tai `+48` (sâu `3.5 mm`, miệng `7 mm`, cách mép ngoài `~18 mm`). |
| **`nep_c`** (`Nẹp C`) | Liền thân | **`+12.5`** | **`12.5 mm`** (khấu tổng `25 mm`) | **Không** vẽ thanh cài rời màu vàng. 3D: uốn cong **180°** mượt 6 đoạn (5 cung `1.1 mm × 36°` + đoạn gập `7.0 mm` = `12.5 mm`) ôm sát mặt ngoài, chạy sát 4 góc (hở kỹ thuật `1.2–1.8 mm`). 2D/DXF/3D: vát chéo 2 góc ngoài đầu mép **`3.5 mm`** (`NEP_C_CORNER_CHAMFER_MM = 3.5`). |
| **`be_chan`** (`Bẻ chân`) | Liền thân | **`+F`** (`5–100`, mặc định `20`) hoặc `0` nếu `straight` | `0` | Chọn độc lập từng cạnh `Trên/Dưới/Trái/Phải`: `Bẻ vào` (`in`), `Bẻ ra` (`out`), `Để thẳng` (`straight`) + 5 preset nhanh (`4 vào`, `4 ra`, `2 vào–2 ra`, `2 vào–2 thẳng`, `2 ra–2 thẳng`). Góc bẻ vào ghép **vuông đối đầu** (`sqTrim = F + 1.5 mm` ở vách đứng hông), không vát 45° hở lớn. |
| **`lcct`** (`Lưới LCCT`) | Liền thân + khung rời | **`+20`** | `0` | Chấn 90° quay vào lòng trong `+20 mm` (2D vát 45° sâu `≤ 18 mm`). Tùy chọn `showLcctMesh` (mặc định BẬT): khung viền rời + nẹp chia ô + lưới thép mắt vuông. |
| **`end_cap`** (`Đầu bịt kín`) | Liền thân / tự do + tấm rời | **`+31`** (cạnh Mí gò) / **`+0`** (cạnh Mí hàn) | `0` | 4 cạnh độc lập chọn `Mí gò` / `Hàn chập` (`7–25 mm`, mặc định `10`) / `Hàn đấu đầu` (`0`). Nếu không gộp bằng `Ghép tự do`, tự sinh mảnh bịt rời (`1-B/1-E/1-F...`) kích thước `(W + trái + phải) × (H + trên + dưới)`: cạnh Mí gò bù **`+7 mm` vát `8°`** (`~0.984 mm`), cạnh Hàn chập bù `7–25 mm` vát `1 mm`, cạnh Đấu đầu `+0`, có dập gân thẳng. |
| **`plain`** (`Để thẳng`) | Liền thân | **`+L_thẳng`** (`0–300`, mặc định `0`) | `0` | Nếu `plainExtensionMm > 0`: đoạn kéo dài trơn hoàn toàn, **KHÔNG chạy mí dọc thân** trên đoạn kéo dài; `0` là cắt phẳng không bích. |
| **`bich_v_out`** (`Bích V ngoài`) | **Bích rời** (không lỗ) | **`+8`** (`V30/40/50` thường) / **`+0`** (`EI` & `V80×30`) | **`vSize + 5`** (`35/45/55 mm`) với V30/40/50; **`0`** với `V80×30` | Quy cách `V30×30`, `V40×40` (mặc định), `V50×50`, `V80×30`, dày `2/3/4 mm` (mặc định `3`). Kiểu `standard`: lòng trong `W+5 × H+5`, mép tôn lật `+8 mm` (2D có bậc lõm nhỏ `1.5 mm` sát góc). Kiểu `ei` & `V80×30` (cánh 30 lọt lòng): cánh ôm lọt lòng `W−3 × H−3`, cắt thẳng `+0 mm`. |
| **`bich_v_in`** (`Bích V trong`) | **Bích rời** (không lỗ) | **`+0`** | **`vSize + 5`** (`35/45/55 mm`) | Quy cách `V30×30`, `V40×40`, `V50×50`, dày `2/3/4 mm`. Phủ bì nằm gọn lòng trong `W−3 × H−3`, mặt bích phẳng đồng mặt miệng ống, cắt thẳng `+0 mm`. |
| **`bich_u`** (`Bích U`) | **Bích rời** (không lỗ) | **`+0`** | `0` | Bích chấn chữ U không cân: dày `1.5/2/3 mm` (mặc định `2`), cánh ôm thân `15–120 mm` (mặc định `30`), mặt bích `15–120 mm` (mặc định `40`), **gờ bẻ ngoài cố định `BICH_U_OUTER_LIP_MM = 10 mm`** quay ngược về phía thân, nối kín vuông góc tại cả 4 góc ngoài. |

- **Quy tắc chung cho Bích V & Bích U rời:** Ghép 2 thanh ngang phủ bì + 2 thanh đứng lọt lòng (KHÔNG cắt vát 45° mặt trước), KHÔNG vẽ lỗ bulong; phía sau cánh ôm có vát góc 45° tránh cấn mí ống.

### B. Mí ghép dọc & Mí hàn (`SeamType`, `src/core/rules/ductRules.ts`, `flatPattern2D.ts`, `geometry3D.ts`)
- **`pittsburgh` — Mí gò Pittsburgh:**
  - **Mí kép (Female):** bù **`+31 mm`** (`PITTSBURGH_FEMALE_ALLOWANCE = 31`). Mặc định đặt trên cạnh lớn hơn (`W ≥ H` → `Trên/Dưới`; riêng `2 mảnh U+I` đặt mí kép trên 2 hông `Trái/Phải` của mảnh U). Hỗ trợ nút `Đảo mí` toàn cục hoặc đảo riêng từng góc (`seamOverrides`).
  - **Mí đơn (Male):** bù **`+7 mm`** (`PITTSBURGH_MALE_ALLOWANCE = 7`). Hai đầu dải mí đơn trên **cả 3D, 2D và DXF** vát nhẹ góc **`8°`** (`DEFAULT_MALE_SEAM_BEVEL_DEG = 8`, kẹp trong `5°–10°`, độ vát vào `7 × tan(8°) ≈ 0.984 mm`).
- **`weld_overlap` — Hàn chập:** cánh cái (Female) bù **`7–25 mm`** (mặc định **`10 mm`**), cánh đối diện `+0 mm`. Có dựng mối hàn 3D dọc góc khi `Đã gò mí` & `explode/unfold < 2%`.
- **`weld_butt` — Hàn đấu đầu:** **`0 – 0 mm`**, dựng mối hàn góc 3D.
- **Cảnh báo ống ngắn:** Khi `L < 140 mm` hiện gợi ý nhẹ nên cân nhắc Mí hàn (vẫn cho chọn tự do).
- **Nối C (`17 + 17 mm`):** Đã ghi nhận trong thông báo vượt khổ & `REF_NOTES.md`.

---

## 4. Tính năng 3D, Mở phôi 3D, Ghép mảnh tự do & Trải phẳng 2D / DXF

### Đồ thị Mặt–Cạnh `FoldGraph` & Chế độ `Ghép tự do` (`src/core/foldGraph/foldGraph.ts`)
- Quản lý tối đa **6 mặt** (ID nội bộ: `top`, `bottom`, `left`, `right`, `cap_c1`, `cap_c2`) và **12 cạnh tiếp giáp** (ID nội bộ: `TL`, `TR`, `BR`, `BL`, `C1_top..right`, `C2_top..right`), mỗi cạnh có trạng thái độc lập: `'bend'` (**Chấn 90° liền mảnh**, xanh lá) hoặc `'seam'` (**Mí ghép rời**, vàng cam).
- **Nhãn hiển thị tiếng Việt chuẩn (đồng bộ 100% ở mọi nơi trên UI):**
  - 4 cạnh dọc thân ống (lưới **2 cột × 2 hàng** trong `ParamsTab.tsx`): `Trên – Trái` (`TL`), `Trên – Phải` (`TR`) ở hàng trên; `Dưới – Trái` (`BL`), `Dưới – Phải` (`BR`) ở hàng dưới.
  - Cạnh tiếp giáp bịt Kết nối 1 / Kết nối 2: `Kết nối 1 – Trên`, `Kết nối 1 – Dưới`, `Kết nối 1 – Trái`, `Kết nối 1 – Phải` (tương tự cho `Kết nối 2`).
- **Quy tắc trải phẳng thực tế & Tự động mở mí thông minh (`validateSetEdgeToBend`, `App.tsx`):**
  - Toàn bộ **45** cây khung 5 mặt và **384** cây khung 6 mặt của hộp chữ nhật đều trải phẳng 2D với **0 chồng đè** (kể cả ghép mặt bịt vào 2 mặt đối diện như `Trên — Bịt Kết nối 1 — Dưới`).
  - **Không chặn cứng khi bấm ghép cạnh:** Nếu bấm gộp cạnh mới làm khép kín một vòng mặt qua các nếp chấn sẵn có, hệ thống **gộp ngay lập tức** và **tự động mở 1 cạnh xung đột thông minh nhất** (ví dụ đang có `1 mảnh O + Kết nối 1 – Trên`, bấm `Kết nối 1 – Dưới` sẽ tự mở `Dưới – Trái`, giữ liền cả `Kết nối 1 – Trên` lẫn `Kết nối 1 – Dưới` thành phôi chữ Z 5 mặt).
  - Hiển thị thanh thông báo không chặn (xanh ngọc) ngay đầu viewport với tên tiếng Việt chuẩn kèm nút **`Đổi mở <tên cạnh>`** (ví dụ `Đổi mở Trên – Trái`, `Đổi mở Kết nối 1 – Trên`) và nút **`Hoàn tác`**.
- **6 preset trong bảng `Ghép tự do` (`FreeMergePresetId`):** `Gộp Bịt Kết nối 1 + Trên`, `Bịt Kết nối 1 nối Trên+Dưới`, `Chữ thập 5 mặt`, `Hộp kín 6 mặt`, `Tách hết`, `Đặt lại`.

### Kiến trúc Bản lề 3D 60fps, `Mở phôi 3D`, `Tách mảnh` & Nhãn mặt (`src/products/ong-vuong-thang/geometry3D.ts`, `DuctAssembly.tsx`)
- **Zero-rebuild 60fps:** `buildUnfoldableDuctRig` chỉ chạy khi đổi kích thước/kết cấu. Kéo `Mở phôi 3D`, `Tách mảnh` hay chuyển `Chưa gò mí ↔ Đã gò mí` chỉ cập nhật `position`, `quaternion`, `rotation` và độ mờ vật liệu của các `THREE.Group` pivot.
- **`Mở phôi 3D (0% → 100%)`** (điều khiển qua `capabilities.unfoldSupported`):
  - `0% → 30%`: chi tiết rời (ke góc TDC, Bích V/U, khung lưới LCCT, mảnh bịt rời) trượt lùi dọc trục và mờ dần (`opacity: 1 → 0.28`).
  - `6% → 100%` (góc thân/bịt) & `12% → 94%` (nếp bích/mí): xoay mở phẳng toàn bộ các mặt thân + đầu bịt đã gộp và toàn bộ nếp gấp liền tôn về mặt phẳng nằm ngang `y = 0`, lòng trong `MẶT ĐÁNH DẤU` ngửa lên trên.
- **`Tách mảnh (0% → 100%)` & `Chưa gò mí`:**
  - Mảnh đa phần: tịnh tiến tách rời theo hướng pháp tuyến / hướng rút rãnh mí không va chạm.
  - **Khối liền 1 mảnh (`1 mảnh O` hoặc khối gộp tự do còn 1 mảnh duy nhất):** bung mở mượt các nếp chấn `90°` quanh mặt gốc lên tới **`24°`** (`16°` nếu gốc là mặt bịt như `Chữ thập 5 mặt`), phối hợp đồng bộ với ke góc/bích/bịt đầu trượt rời. Khi chuyển **`Chưa gò mí`** trên `1 mảnh (O)`, vách mang mí đơn tự hé nhẹ (`unseamedOpenFactor`, `~13.5 mm` mí gò / `8.5 mm` mí hàn).
- **Nhãn mặt trong lòng ống (`1-A, 1-B, 1-C...`):** đánh số tuần tự theo danh sách component của `FoldGraph`, dán decal vào đúng mặt trong lòng ống (`MẶT ĐÁNH DẤU`) và đồng bộ 2D + bảng `S Phôi`.

### Trải phẳng 2D (`src/products/ong-vuong-thang/flatPattern2D.ts`, `src/core/ui/FlatPattern2DViewer.tsx`) & Xuất DXF (`src/core/export/dxfExporter.ts`)
- **Kiến trúc 2D mở:** Đường bao cắt lưu thành `EditableContour2D` (`vertices` gắn tag `male_bevel`, `nep_c_chamfer`, `tdc_notch`, `tdc_tdf_indent`, `bend_notch` + `segments` + `innerContours` dự phòng cho lỗ trổ). Với mảnh gộp cây tự do (5–6 mặt), tự động đi chu trình Euler-Tour tạo **1 đường bao cắt khép kín duy nhất** và phát hiện chồng lấn 2D (`hasOverlap2D`, `overlapRects`).
- **Quy chuẩn file `.dxf` thực tế (`src/core/export/dxfExporter.ts`):**
  - **Thư viện:** `@tarikjabiri/dxf` (`DxfWriter`), ASCII DXF chuẩn **AutoCAD 2021 (`AC1021`) & Bodor Thinker 3.0**.
  - **Đơn vị & Hệ tọa độ:** tỷ lệ tuyệt đối **`1:1` (mm)** (`$INSUNITS = 4`, `$MEASUREMENT = 1`), trục Y hướng lên trên (chuẩn CAD), tự điền `$LIMMIN/$LIMMAX/$EXTMIN/$EXTMAX` và `activeVPort`, xếp mảnh cách đều `DXF_PIECE_GAP_MM = 20 mm`.
  - **Định dạng tên file:** **`YYYYMMDD_HHmmss.dxf`** (`formatDxfTimestampFileName`).
  - **Đúng 2 Layer đối tượng (Layer `0` để trống):**
    1. **`CUT`** (màu ACI `7`): duy nhất các biên cắt ngoài (và `innerContours`/`innerHoles` nếu có) dạng **`LWPOLYLINE` khép kín**.
    2. **`DIM`** (màu ACI `3`): duy nhất đối tượng **`DIMENSION` gốc DXF** (`addLinearDim`, style `Standard`) cho kích thước `total` (offset `92 mm`) & `segment` (offset `44 mm`).
  - **Loại bỏ 100% khỏi DXF:** đường chấn nét đứt, đường gân tăng cứng, đường giới hạn khổ tôn/lăn gân, mọi ghi chú callout và chữ `1-A, 1-B...`.

---

## 5. Giao diện & Tương tác UI hiện tại

- **Bố cục tổng thể:**
  - **Cột trái (`320 px`, có nút thu gọn toàn màn hình `#btn-collapse-sidebar`):** Brand `EUSTEEL DUCT3D` (không mã M1.3) → **`ProductSelector`** (1 thanh chọn gọn mở ra cây **7 nhóm sản phẩm** không mã M1–M5) → 3 tab **`Thông số`** | **`Nhập LSX`** | **`S Phôi`**. Trong tab `Thông số`: Cấu hình mẫu nhanh (accordion mặc định đóng, 6 mẫu), Kích thước W/H/L, Vật liệu & Độ dày, thẻ tóm tắt `Kết nối 1 (Trước)` / `Kết nối 2 (Sau)` + `Kết nối 1 → 2`, Chia mảnh (`1 mảnh (O)`, `2 mảnh L`, `2 mảnh U+I`, `4 mảnh rời`) + `Ghép tự do` (lưới 2×2 cạnh dọc `Trên – Trái`, `Trên – Phải` / `Dưới – Trái`, `Dưới – Phải`) + `Tự động/Thủ công`, Mí ghép dọc mặc định + `Đảo mí`, công tắc `Gân tăng cứng`.
  - **Thanh công cụ trên Viewport (`TopToolbar.tsx`):** đọc `capabilities` từ sản phẩm đang chọn (`Xem 3D` | `Trải phẳng 2D` | `Song song 3D + 2D` • `Tôn Mạ Kẽm / Inox` | `Tô màu kỹ thuật` • `Chưa gò mí` | `Đã gò mí` • `Tách mảnh` • `Mở phôi 3D` • `Nhãn mặt` • `Gân tăng cứng` • `Đảo mí` • `Cài đặt xưởng`).
  - **Lớp phủ Viewport 3D (`ViewportOverlays.tsx`):** nút `Bảng điều khiển`, thẻ đối tượng đang chọn (`Đang chọn mảnh: 1-A`, `Đang chọn: Kết nối 1`, `Đang chọn mí: Trên – Phải`, `Đang chọn cạnh: Kết nối 1 – Trên`), chú giải màu kỹ thuật, thanh tóm tắt & 5 nút camera preset.
  - **Thanh công cụ 2D (`FlatPattern2DViewer.tsx`):** Zoom `− / +`, `%`, `Vừa màn hình`, `Tải file DXF` (theo `capabilities.dxfSupported`), `In / Lưu PDF` và thanh trạng thái khổ tấm / lăn gân / Tổng S (`m²`).
- **Quy chuẩn tương tác chuột (đồng bộ 2 chiều 3D ↔ 2D):**
  - **3D:** Kéo chuột trái = Xoay; Cuộn = Zoom; **Kéo chuột phải (`≥ 4 px`) = Pan**.
  - **2D:** Cuộn = Zoom theo tâm trỏ; Kéo chuột trái (`> 4 px`) = Pan.
  - **Click đơn chuột trái:** chỉ chọn & tô sáng đối tượng, không tự bung thẻ chỉnh.
  - **Click đúp chuột trái** (hoặc bấm `Chỉnh` / thẻ `Kết nối 1`, `Kết nối 2`): mở `Floating Inspector`.
  - **Click chuột phải đứng yên (`< 4 px`):** mở `Context Menu` (kèm 2 mục khóa mờ `Chặng sau`: `+ Trổ lỗ / Chân rẽ mặt này` và `+ Lớp bọc mặt này`). Phím `Esc` đóng lần lượt Context Menu → Floating Inspector → Bỏ chọn.
- **Chế độ hiển thị màu (`galvanizedMaterial.ts`):**
  - **Vật liệu thật:** `Tôn Mạ Kẽm` hoa nhỏ hoặc `Inox` sáng mịn.
  - **Tô màu kỹ thuật (6 vùng):** Thân tôn `#9eb0c4`, **Đỏ `#e13f3f` = Mí kép (+31)**, **Xanh dương `#2f7cf6` = Mí đơn (+7)**, **Xanh lá `#22c55e` = Đường chấn 90°**, **Cam `#f97316` = Mí hàn**, **Vàng `#eab308` = Bích kết nối**.
- **Từ khóa bị cấm tuyệt đối trên toàn bộ UI (kể cả Menu sản phẩm):** `SVG`, `kg`, `cửa gió`, `van gió`, `Hàn chồng`, `xước mịn`, `xước mờ`.

---

## 6. Tổng hợp các chỉnh sửa riêng đã chốt (từ `git log` & `REF_NOTES.md`)

Danh sách các tinh chỉnh thực tế đã chốt — **bắt buộc giữ nguyên, không ghi đè mất ở các chặng sau:**

1. **Bích TDC/TDF & Ke góc 3D/2D (`2cb2e89`, `bdac3d3`, `REF_NOTES.md` §1–2):**
   - Bỏ vết khấu tam giác giữa cạnh dài bích; giữ khe khấu đường chấn song song rộng đúng **`2 mm`** kết mũi V nhỏ.
   - Bậc khấu 2D góc ngoài TDC/TDF cắt vuông 90° + bậc chuyển `~1.5 mm`; dấu lõm TDF nằm trên cạnh bên tai `+48 mm`.
   - 3D mặt bích TDC có gân giật bậc dọc giữa mặt bích và mép cuốn J-return sát mặt sau; 4 ke góc TDC đồng mặt phẳng với mặt bích, có gân dập nổi dọc chân, ngạnh giữ, vát chéo ngoài và lỗ bulong giọt nước quay mũi V vào góc trong.
2. **Mí kép Pittsburgh & Mí đơn (`bdac3d3`, `REF_NOTES.md` §7):**
   - 3D Mí kép `+31 mm` dạng chuỗi bản lề lăn 6 đoạn có vai lăn nổi & rãnh chữ U; dừng đúng trước vùng khấu đầu ống (`12 mm` TDC, `12.5 mm` Nẹp C, `10 mm` Bích V).
   - Mí đơn `+7 mm` vát nhẹ **`8°`** (`~0.984 mm` trên `7 mm`) đồng bộ 3D, 2D và DXF.
3. **Nẹp C liền thân (`3c01564`, `bdac3d3`, `REF_NOTES.md` §5):**
   - Không vẽ thanh cài rời màu vàng; uốn cong **180° mượt 6 đoạn** ôm sát mặt ngoài; vát chéo 2 góc ngoài đầu mép **`3.5 mm`** đồng bộ 3D, 2D và DXF.
4. **Bích V & Bích U rời (`7c638da`, `2cb2e89`, `bdac3d3`, `REF_NOTES.md` §3–4):**
   - Ghép vuông 2 thanh phủ bì + 2 thanh lọt lòng, không vát 45° mặt trước, không vẽ lỗ bulong; Bích V có bo gốc trong & vát 45° đuôi cánh ôm; Bích U có gờ bẻ ngoài cố định **`10 mm`** nối kín 4 góc ngoài.
5. **Bẻ chân & Để thẳng (`3c01564`, `2cb2e89`, `REF_NOTES.md` §6):**
   - `Bẻ chân vào` ghép vuông đối đầu; `Để thẳng` không chạy mí dọc trên đoạn `+L_thẳng`.
6. **Gân tăng cứng & Kiểm tra khổ (`3c01564`, `2cb2e89`):**
   - Hướng gân luôn song song `Kết nối 1 / Kết nối 2`, bước mặc định `210 mm`, kiểm tra khổ máy lăn gân (`1900 mm`) theo `L_phôi`; kiểm tra lọt khổ tấm cho phép xoay `0° / 90°`.
7. **DXF & Tương tác UI (`2cb2e89`, `bdac3d3`):**
   - Bỏ hoàn toàn nút tải SVG; xuất DXF `AC1021` tên `YYYYMMDD_HHmmss.dxf`, chỉ 2 layer `CUT` + `DIM`.
   - Click đơn chỉ chọn/tô sáng, click đúp mới mở `Floating Inspector`; dải bắt cạnh 3D bật depth-test chuẩn.
8. **`Tách mảnh` 1 mảnh (`8d20145`) & `Ghép tự do` thực tế (`e062776`):**
   - Bung mở góc chấn (`≤ 24°` / `≤ 16°`) khi kéo `Tách mảnh` trên cấu hình 1 mảnh + hé vách mí đơn khi `Chưa gò mí`.
   - Bỏ chặn cứng khi ghép cạnh vòng kín: tự mở 1 cạnh xung đột thông minh + toast không chặn với nút `Đổi mở ...` & `Hoàn tác`.
9. **Tái cấu trúc 3 lớp + Menu 7 nhóm + Việt hóa nhãn UI (Bước 2):**
   - Tách sạch `src/core/`, `src/products/`, `src/addons/`, xóa 4 file legacy thừa; thêm `docs/ARCHITECTURE.md` và `docs/01_SPEC_CORE.md`.
   - Chuẩn hóa cây Menu 7 nhóm sản phẩm (bỏ toàn bộ mã `M1–M5`) và Việt hóa đồng bộ toàn bộ nhãn `Trên – Trái`, `Trên – Phải`, `Dưới – Trái`, `Dưới – Phải` (lưới 2×2), `Kết nối 1`, `Kết nối 2`, `Kết nối 1 → 2`, `Bịt Kết nối 1 / 2` trên mọi vùng giao diện & bản vẽ 2D.
