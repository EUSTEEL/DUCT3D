# EUSTEEL DUCT3D — Quy chuẩn Lõi kỹ thuật dùng chung (`docs/01_SPEC_CORE.md`)

> Tài liệu khóa chuẩn các quy tắc vật liệu, khổ tấm, đầu kết nối, mí ghép, đồ thị gập, trải phẳng 2D và xuất DXF nằm trong `src/core/`, dùng chung cho toàn bộ các sản phẩm của EUSTEEL DUCT3D.

---

## 1. Vật liệu, khổ tấm chuẩn & Cài đặt xưởng
- **Khóa `localStorage`:** `eusteel_duct3d_workshop_settings_v1` (`src/core/rules/workshopSettings.ts`).
- **Danh sách vật liệu & độ dày:**
  - **`Tôn Mạ Kẽm` (`galvanized`):** khổ mặc định **`1200 × 6000 mm`**, độ dày `0.58 / 0.75 (mặc định) / 0.95 / 1.15 / 1.2 / 1.5 mm`.
  - **`Inox` (`inox`):** khổ mặc định **`1250 × 6000 mm`**, độ dày `0.6 / 0.8 (mặc định) / 1.0 mm`.
- **Popup `Cài đặt xưởng` (`WorkshopSettingsModal.tsx`):**
  - Khổ máy lăn gân tối đa: mặc định **`1900 mm`** (`600–4000 mm`).
  - Khoảng cách bước gân tăng cứng: mặc định **`210 mm`** (`80–600 mm`).
  - Khổ tấm Tôn Mạ Kẽm & Inox: tùy chỉnh rộng `500–3000 mm`, dài `1000–12000 mm`.

## 2. Quy tắc `S Phôi`, kiểm tra khổ tấm (0°/90°) & gân tăng cứng
- **Chỉ tính diện tích phôi (`m²`), tuyệt đối không tính/hiển thị khối lượng (`kg`).**
- **Kiểm tra lọt khổ tấm (`0°` hoặc xoay `90°`):**
  - `ngang_chuan` (Đạt — xanh): `L_phôi ≤ W_tấm` và `B_phôi ≤ L_tấm`.
  - `doc_6000` (Đạt — xoay dọc 90°): `B_phôi ≤ W_tấm` và `L_phôi ≤ L_tấm`.
  - `vuot_kho` / `can_noi_c` (Đỏ): vượt khổ theo cả 2 hướng → cần chia mảnh hoặc **Nối C (`17 + 17 mm`)**.
- **Gân tăng cứng:**
  - Duy nhất 1 dạng gân thẳng lồi mặt ngoài, **luôn chạy song song 2 đầu bích `Kết nối 1` & `Kết nối 2`** (vuông góc trục chiều dài `L`).
  - Bước mặc định `210 mm`, khoảng hở mỗi đầu `≥ 90 mm`, sinh gân khi `L ≥ 220 mm`, đối xứng qua tâm.
  - **Kiểm tra khổ máy lăn gân (`1900 mm`):** kiểm tra theo **chiều vuông góc đường gân** (`L_phôi` trên thân ống).

## 3. Thư viện 9 loại Đầu kết nối (`Kết nối 1` / `Kết nối 2`) & 3 loại Mí dọc
- **Bích liền thân:**
  1. `TDC/TDF`: bù **`+48 mm`**, khấu mí vào thân `12 mm` (tổng `60 mm`), khe bẻ giữa các mặt song song **`2 mm`**, mặt bích 3D có gân giật bậc + cuốn J-hook, 4 ke góc rời đồng mặt phẳng có lỗ giọt nước quay mũi V vào góc trong; tùy chọn dấu lõm V cạnh tai (`showEndIndent`, mặc định TẮT).
  2. `Nẹp C`: bù **`+12.5 mm`**, khấu `12.5 mm` (tổng `25 mm`), uốn cong **180° liền thân** 6 đoạn không thanh cài rời, vát góc ngoài đầu mép **`3.5 mm`**.
  3. `Bẻ chân`: bù **`+F`** (`5–100 mm`, mặc định `20 mm`), chỉnh từng cạnh (`Trên/Dưới/Trái/Phải`: `Bẻ vào / Bẻ ra / Để thẳng`) + 5 mẫu nhanh; `Bẻ vào` ghép **vuông đối đầu**.
  4. `LCCT` (Lưới chắn côn trùng): bù **`+20 mm`** vát 45° chấn vào trong + khung lưới rời tùy bật/tắt.
  5. `Đầu bịt kín`: 4 cạnh chọn độc lập `Mí gò` (`+31` chờ thân / `+7` vát `8°` trên mảnh bịt) hoặc `Hàn chập` (`7–25 mm`) / `Hàn đấu đầu` (`+0`).
  6. `Để thẳng`: bù **`+L_thẳng`** (`0–300 mm`), đoạn kéo dài trơn không chạy mí dọc.
- **Bích rời (ghép 2 thanh phủ bì + 2 thanh lọt lòng, KHÔNG cắt vát 45° mặt trước, KHÔNG vẽ lỗ bulong):**
  7. `Bích V ngoài`: `V30×30 / V40×40 / V50×50` (kiểu thường `+8 mm` có bậc lõm `1.5 mm` sát góc, kiểu EI `+0 mm`) & `V80×30` (cánh 30 lọt lòng `W−3 × H−3`, `+0 mm`); có bo lượn góc gốc và vát 45° đuôi cánh ôm.
  8. `Bích V trong`: `V30×30 / V40×40 / V50×50` nằm gọn lòng trong `W−3 × H−3`, `+0 mm`.
  9. `Bích U`: dày `1.5/2/3 mm`, cánh ôm `15–120 mm`, mặt bích `15–120 mm`, **gờ bẻ ngoài cố định `10 mm`** nối kín liên tục cả 4 góc ngoài.
- **Mí ghép dọc:**
  - `Mí gò` (Pittsburgh): Mí kép **`+31 mm`** (3D bản lề lăn 6 đoạn) + Mí đơn **`+7 mm`** vát nhẹ **`8°`** (`~0.984 mm`) đồng bộ 3D/2D/DXF.
  - `Hàn chập`: `7–25 mm` (mặc định `10 mm`).
  - `Hàn đấu đầu`: `0 – 0 mm`.

## 4. Đồ thị `FoldGraph`, Quy ước nhãn tiếng Việt & Tương tác
- Quản lý 4–6 mặt và tối đa 12 cạnh tiếp giáp (`Chấn 90°` xanh lá ↔ `Mí ghép` vàng cam).
- **Nhãn hiển thị tiếng Việt chuẩn (giữ nguyên ID nội bộ `'TL'`, `'TR'`, `'BR'`, `'BL'`, `'c1'`, `'c2'`):**
  - 4 cạnh dọc thân ống (lưới **2 cột × 2 hàng**): `Trên – Trái`, `Trên – Phải` (hàng trên); `Dưới – Trái`, `Dưới – Phải` (hàng dưới).
  - 2 đầu kết nối: `Kết nối 1` (Trước), `Kết nối 2` (Sau), nút đồng bộ `Kết nối 1 → 2`.
  - Mảnh bịt & cạnh bịt: `Bịt Kết nối 1` / `Bịt Kết nối 2`; `Cạnh tiếp giáp bịt Kết nối 1` (`Kết nối 1 – Trên`, `Kết nối 1 – Dưới`, `Kết nối 1 – Trái`, `Kết nối 1 – Phải`) và tương tự cho `Kết nối 2`.
- **Tự mở mí vòng kín thông minh:** Không chặn cứng khi ghép cạnh mới tạo vòng kín — tự mở 1 cạnh xung đột phù hợp nhất (ưu tiên giữ liền cặp cạnh bịt vừa ghép) và hiện thanh thông báo không chặn kèm nút `Đổi mở <tên cạnh tiếng Việt>` và `Hoàn tác`.
- **Tương tác chuột:** Click đơn chỉ chọn/tô sáng; Click đúp mở `Floating Inspector`; Chuột phải đứng yên (`< 4 px`) mở `Context Menu`; Kéo chuột phải (`≥ 4 px`) trên 3D = Pan.

## 5. Bản vẽ 2D mở & Chuẩn xuất DXF (`src/core/export/dxfExporter.ts`)
- Đường bao cắt lưu dạng mảng đỉnh/đoạn có cấu trúc (`EditableContour2D`, `innerContours`) sẵn sàng cho công cụ chỉnh sửa 2D và lỗ trổ ở các chặng sau.
- Xuất DXF bằng `@tarikjabiri/dxf` chuẩn **AutoCAD 2021 (`AC1021`) / Bodor Thinker 3.0**, đơn vị `1:1 mm` (`$INSUNITS = 4`), tên file **`YYYYMMDD_HHmmss.dxf`**.
- **Đúng 2 layer:** `CUT` (`LWPOLYLINE` khép kín biên cắt ngoài & lỗ khoét) và `DIM` (đối tượng `DIMENSION` gốc DXF). Bỏ sạch đường chấn, đường gân, giới hạn khổ, callout và chữ `1-A, 1-B...`.
- **Từ khóa bị cấm trên giao diện:** `SVG`, `kg`, `cửa gió`, `van gió`, `Hàn chồng`, `xước mịn`, `xước mờ`.
