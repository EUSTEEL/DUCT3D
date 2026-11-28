# EUSTEEL DUCT3D — Kiến trúc 3 lớp cắm–rút (`docs/ARCHITECTURE.md`)

> **Mục tiêu:** Tổ chức mã nguồn tách lõi sạch sẽ để mở rộng hàng chục loại ống gió & phụ kiện vuông/tròn, lỗ trổ/chân rẽ và lớp bọc bảo ôn/EI mà không làm vỡ các sản phẩm đang chạy ổn định.

---

## 1. Cấu trúc thư mục 3 lớp (`src/`) & Tài liệu (`docs/`)

```text
docs/
├── ARCHITECTURE.md                      # Tài liệu kiến trúc 3 lớp, menu 7 nhóm & quy ước nhãn UI (file này)
└── 01_SPEC_CORE.md                      # Quy chuẩn kỹ thuật lõi dùng chung (vật liệu, bích, mí, FoldGraph, DXF)

src/
├── main.tsx                             # Điểm khởi chạy React 19 gắn vào #root
├── App.tsx                              # Điều phối trạng thái activeProduct, DuctConfig, WorkshopSettings, 3D/2D & Toast
├── index.css                            # Tailwind CSS v4 + nền studio 3D/2D, scrollbar và slider tùy biến
├── core/                                # LÕI DÙNG CHUNG (mọi sản phẩm chỉ import một chiều từ đây)
│   ├── constants.ts                     # Hằng số hình học lõi (MM_TO_M = 0.001)
│   ├── types/
│   │   ├── duct.ts                      # Kiểu dữ liệu ống, vật liệu, đầu kết nối, FoldEdgeId, WorkshopSettings, SelectionTarget
│   │   ├── flatPattern2d.ts             # Kiểu dữ liệu bản vẽ 2D mở (EditableContour2D, Dimension2D, OverlapRect2D)
│   │   └── product.ts                   # ProductGroupId (7 nhóm), ProductStatus, ProductCapabilities, ProductDefinition
│   ├── rules/
│   │   ├── workshopSettings.ts          # Hằng số & lưu localStorage (eusteel_duct3d_workshop_settings_v1)
│   │   ├── ductRules.ts                 # Vật liệu, nhãn tiếng Việt chuẩn (END_LABELS, CORNER_SHORT_LABELS), chia mảnh, S Phôi, LSX
│   │   └── endConnectionRules.ts        # Bù phôi (+mm), khấu góc, kích thước 9 loại đầu kết nối
│   ├── foldGraph/
│   │   └── foldGraph.ts                 # Đồ thị Mặt–Cạnh 4–6 mặt, tự mở mí vòng kín, nhãn cạnh tiếng Việt chuẩn
│   ├── flanges/
│   │   └── endConnectionBuilder.ts      # Dựng mesh 3D phụ kiện rời (ke góc TDC, Bích V/U, khung LCCT, mảnh bịt rời)
│   ├── export/
│   │   ├── dxfExporter.ts               # Xuất ASCII DXF AC1021 (2 layer CUT + DIM, tên YYYYMMDD_HHmmss.dxf)
│   │   └── flatPatternSvgExport.ts      # Tiện ích path & in/lưu PDF từ SVG ngầm
│   ├── materials/
│   │   ├── galvanizedMaterial.ts        # Vật liệu PBR Tôn Mạ Kẽm, Inox & 6 vùng Tô màu kỹ thuật
│   │   └── faceLabelTexture.ts          # Texture nhãn đánh dấu lòng trong 1-A, 1-B...
│   ├── scene/
│   │   ├── sceneContext.ts              # Context chuột phải an toàn cho các assembly 3D cắm-rút
│   │   └── DuctScene.tsx                # Khung Canvas Three.js, ánh sáng HDRI, Grid, ContactShadows, OrbitControls
│   └── ui/
│       ├── LeftSidebar.tsx              # Khung cột trái 320px chứa ProductSelector + 3 tab (Thông số | Nhập LSX | S Phôi)
│       ├── ProductSelector.tsx          # Menu chọn sản phẩm dạng cây 7 nhóm (đọc tự động từ products/registry.ts)
│       ├── TopToolbar.tsx               # Thanh công cụ viewport đọc capabilities (3D/2D/Song song, Mở phôi 3D...)
│       ├── ViewportOverlays.tsx         # Nút mở sidebar, thẻ đối tượng đang chọn, chú giải màu, thanh trạng thái, camera preset
│       ├── FlatPattern2DViewer.tsx      # Trình xem 2D cắm-rút (Zoom/Pan, chọn 2 chiều, Tải file DXF theo dxfSupported, In PDF)
│       ├── SelectionContextUI.tsx       # Menu chuột phải (Context Menu) & Thẻ chỉnh nhanh nổi (Floating Inspector)
│       ├── EndConnectionPanel.tsx       # Bảng chọn 9 loại đầu kết nối (Kết nối 1 / Kết nối 2)
│       ├── WorkshopSettingsModal.tsx    # Popup Cài đặt xưởng
│       └── NumericDraftInput.tsx        # Ô nhập số kỹ thuật cho phép gõ tay tự do
├── products/                            # CÁC SẢN PHẨM CẮM–RÚT (đăng ký tập trung tại registry.ts)
│   ├── registry.ts                      # Sổ đăng ký trung tâm 7 nhóm sản phẩm & capabilities
│   └── ong-vuong-thang/                 # Ống vuông thẳng (sẵn sàng)
│       ├── index.ts                     # Khai báo ONG_VUONG_THANG_PRODUCT & export module
│       ├── geometry3D.ts                # Hệ bản lề 3D 60fps, Mở phôi 3D, Tách mảnh
│       ├── flatPattern2D.ts             # Trải phẳng 2D tuyến tính, đầu bịt rời & cây Euler-Tour
│       ├── DuctAssembly.tsx             # Component R3F render 3D ống vuông thẳng
│       └── ui/
│           ├── ParamsTab.tsx            # Tab Thông số riêng của Ống vuông thẳng
│           ├── LsxTab.tsx               # Tab Nhập LSX nhanh
│           └── BlankAnalysisTab.tsx     # Tab S Phôi (m²)
└── addons/                              # PHÂN HỆ MỞ RỘNG CHỜ CHẶNG SAU (chỉ khai báo kiểu TypeScript)
    ├── face-features/
    │   └── index.ts                     # Kiểu nền cho lỗ trổ, chân rẽ, cổ nối, cửa thăm, tai treo, tyren, tăng cứng V...
    └── insulation-ei/
        └── index.ts                     # Kiểu nền cho bọc tấm EI, bông thủy tinh, xốp PE, vỏ bọc tôn...
```

---

## 2. Nguyên tắc phụ thuộc 1 chiều
- `App.tsx` → điều phối `src/core/*` và `src/products/*`.
- `src/products/*` → chỉ import từ `src/core/*` (và sau này `src/addons/*`), không import chéo giữa các sản phẩm.
- `src/core/*` → hoàn toàn độc lập với từng sản phẩm cụ thể (**duy nhất** `src/core/ui/ProductSelector.tsx` đọc danh sách từ `src/products/registry.ts`).
- `src/addons/*` → chỉ tham chiếu kiểu cơ bản từ `src/core/types/*`.

---

## 3. Cây Menu sản phẩm chuẩn 7 nhóm (`src/products/registry.ts`)
Không gắn mã `M1–M5` trên giao diện. `ProductSelector` tự động dựng cây từ `PRODUCT_GROUPS` & `PRODUCT_REGISTRY` (tạm bỏ `Măng xông`, `Quang treo` để bổ sung ở chặng sau):

| STT | Nhóm sản phẩm (`ProductGroupId`) | Các sản phẩm con | Trạng thái |
| :-: | :--- | :--- | :--- |
| 1 | **Ống thẳng** (`ong_thang`) | `Ống vuông thẳng` | **Sẵn sàng** (mặc định) |
| 2 | **Côn thu** (`con_thu`) | `Côn thu vuông - vuông`, `Côn thu vuông - tròn`, `Côn thu vuông - tròn EI` | Chặng sau |
| 3 | **Cút vuông** (`cut_vuong`) | `Cút vuông` *(gộp 90°, 45°, lẻ độ vào thông số góc)*, `Cút vuông EI` | Chặng sau |
| 4 | **Z vuông** (`z_vuong`) | `Z vuông`, `Z lượn tròn` | Chặng sau |
| 5 | **Tê & Chạc** (`te_chac`) | `Tê vuông`, `Chạc 3`, `Chạc 4`, `Tê / Chạc EI` | Chặng sau |
| 6 | **Hộp gió** (`hop_gio`) | `Hộp gió / Máng`, `Hộp đầu máy` | Chặng sau |
| 7 | **Ống & Phụ kiện tròn** (`ong_phu_kien_tron`) | `Ống tròn trơn`, `Ống tròn xoắn`, `Cút tròn`, `Côn tròn`, `Z tròn`, `Tê / Chạc tròn` | Chặng sau |

### Điều khiển theo năng lực sản phẩm (`ProductCapabilities`)
- `unfoldSupported`: bật/tắt nhóm `Mở phôi 3D` trên `TopToolbar`.
- `flatPatternSupported`: bật/tắt `Trải phẳng 2D` và `Song song 3D + 2D` (tự về `Xem 3D` nếu sản phẩm không hỗ trợ trải phẳng, ví dụ `Ống tròn xoắn`).
- `dxfSupported`: bật/tắt nút `Tải file DXF` trên `FlatPattern2DViewer`.
- `freeMergeSupported`: bật/tắt chế độ `Ghép tự do` mặt–cạnh.

---

## 4. Quy ước nhãn tiếng Việt trên giao diện & Từ khóa bị cấm
Giữ nguyên ID nội bộ trong mã nguồn (`'TL'`, `'TR'`, `'BR'`, `'BL'`, `'c1'`, `'c2'`, `'C1_top'`...) để bảo toàn tuyệt đối logic, nhưng **mọi nhãn hiển thị ra UI** (Cột trái, `Ghép tự do`, Menu chuột phải, Thẻ chỉnh nhanh nổi, Toast tự mở mí, thanh trạng thái Viewport, bản vẽ 2D) dùng thống nhất 100% tiếng Việt:

- **4 cạnh dọc thân ống** (bố trí lưới **2 cột × 2 hàng** trong `Ghép tự do`: hàng trên `Trên – Trái`, `Trên – Phải`; hàng dưới `Dưới – Trái`, `Dưới – Phải`):
  - `TL` → **`Trên – Trái`**
  - `TR` → **`Trên – Phải`**
  - `BL` → **`Dưới – Trái`**
  - `BR` → **`Dưới – Phải`**
- **2 đầu kết nối & cạnh tiếp giáp đầu bịt:**
  - `C1` / `Đầu C1` → **`Kết nối 1`** (`Kết nối 1 (Trước)`)
  - `C2` / `Đầu C2` → **`Kết nối 2`** (`Kết nối 2 (Sau)`)
  - `C1 → C2` → **`Kết nối 1 → 2`**
  - `Bịt C1` / `Bịt C2` → **`Bịt Kết nối 1`** / **`Bịt Kết nối 2`**
  - `Cạnh tiếp giáp bịt Kết nối 1` / `Kết nối 2`: **`Kết nối 1 – Trên`**, **`Kết nối 1 – Dưới`**, **`Kết nối 1 – Trái`**, **`Kết nối 1 – Phải`** (tương tự cho `Kết nối 2`).
- **Từ khóa bị cấm tuyệt đối trên toàn bộ giao diện (kể cả Menu sản phẩm):**
  - `SVG`, `kg`, `cửa gió`, `van gió`, `Hàn chồng`, `xước mịn`, `xước mờ`.
