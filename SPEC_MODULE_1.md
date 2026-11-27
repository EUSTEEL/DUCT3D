# SPEC MODULE 1: WEB APP 3D ỐNG GIÓ (EUSTEEL)

## 1. Mục tiêu & Kiến trúc tổng thể
- **Mục tiêu:** Web App 3D tham số hóa phục vụ đào tạo nhân sự kỹ thuật & sản xuất đọc hiểu cấu tạo thật của ống gió (mí ghép, bích kết nối liền thân và bích rời, đường chấn, vết khấu, chia mảnh theo khổ tôn `1200 mm` / Inox `1250 mm`, chế độ tự do ghép/tách mảnh 5–6 mặt, trổ lỗ gắn chân rẽ/cổ tròn/tyren).
- **Công nghệ:** React + Vite + TypeScript + Tailwind CSS + Three.js (`@react-three/fiber`, `@react-three/drei`) + `@tarikjabiri/dxf`. Chạy 100% phía trình duyệt (client-side), không cần backend, có thể build tĩnh đẩy lên GitHub Pages.
- **Kiến trúc module sạch (cắm-rút cho hàng chục phụ kiện về sau):**
  - [foldGraph.ts](file:///home/antigravity/EUSTEEL/DUCT3D/src/domain/foldGraph.ts): Đồ thị liên kết Mặt – Cạnh (`Face–Edge Graph`), xác thực cây khung không vòng kín (`Spanning Tree / Cycle Guard`), chia nhóm mảnh liên thông cho ống 4–5–6 mặt.
  - [geometry3D.ts](file:///home/antigravity/EUSTEEL/DUCT3D/src/domain/geometry3D.ts): Dựng hình học 3D chuẩn xưởng đối chiếu `REF_NOTES.md` và hệ bản lề tổng quát 6 mặt mở phôi 60fps không tái tạo geometry (re-export tương thích ngược qua `unfoldRigBuilder.ts`).
  - [flatPattern2D.ts](file:///home/antigravity/EUSTEEL/DUCT3D/src/domain/flatPattern2D.ts): Trải phẳng tọa độ mở `EditableContour2D` (mảng `vertices` & `segments` có thể chỉnh sửa trực tiếp ở các chặng sau), hợp nhất biên dạng cắt khép kín cho mảnh gộp cây 5–6 mặt và kiểm tra tự chồng lấn 2D (`hasOverlap2D`) (re-export qua `flatPatternBuilder.ts`).
  - [dxfExporter.ts](file:///home/antigravity/EUSTEEL/DUCT3D/src/domain/dxfExporter.ts): Xuất file DXF chuẩn AutoCAD 2021 (`AC1021`) & Bodor Thinker 3.0 qua `@tarikjabiri/dxf` kèm block kích thước ẩn danh `*D1..*Dn` và tên file thời gian `YYYYMMDD_HHmmss.dxf` (re-export qua `flatPatternDxfExport.ts`).
- **Ngôn ngữ giao diện:** 100% Tiếng Việt chuyên ngành cơ khí ống gió.
- **Bố cục màn hình:**
  - **Cột trái thu gọn (`320px`, hỗ trợ nút ẩn/hiện để xem 3D/2D toàn màn hình 100%):** 3 Tab:
    1. `Thông số` (giữ gọn tuyệt đối cho các thông số toàn cục: mục **`Cấu hình mẫu nhanh`** dạng accordion **mặc định đóng**, kích thước `W / H / L` kèm bước nhảy `10 / 50 / 100 mm`, vật liệu `Tôn Mạ Kẽm / Inox` & độ dày, 2 thẻ tóm tắt `Đầu C1` / `Đầu C2` click mở bảng nổi + nút `Áp dụng C1 → C2`, chế độ `Chia mảnh` kèm nút **`Ghép tự do`** mở bảng Đồ thị Mặt – Cạnh, `Loại mí mặc định`, công tắc `Gân tăng cứng` theo bước cấu hình xưởng).
    2. `Nhập LSX` (dán text LSX tiếng Việt, Nhập/Xuất thông số JSON bao gồm cấu hình ghép tự do, tự động chia mảnh theo khổ tấm xưởng đang cấu hình).
    3. `S Phôi` (tổng diện tích phôi `m²`, khổ tấm vật liệu đang cấu hình `W_tấm × L_tấm`, phân tích chiều dài phôi `L_phôi = L + bù C1 + bù C2`, bảng kích thước & diện tích `m²` từng mảnh `1-A, 1-B...` đồng bộ 100% với bản trải phẳng 2D kể cả mảnh gộp 5–6 mặt, cảnh báo cam nếu có vùng chồng lấn 2D, trạng thái lọt khổ theo **cả 2 hướng đặt phôi 0° và xoay dọc 90°** và giới hạn máy lăn gân — **không hiển thị khối lượng kg**).
  - **Tương tác trực tiếp trên mô hình 3D & bản vẽ 2D (Tách rõ Click đơn, Click đúp & Chuột phải):**
    - **Click trái đơn (`Single-click`):** CHỈ chọn và tô sáng đồng bộ hai chiều giữa 3D ↔ 2D (hiện thẻ trạng thái nhỏ góc trên-trái `Đang chọn...`), **KHÔNG** tự động mở Bảng thuộc tính nổi (`Floating Inspector`) để không che mất mô hình khi xoay/quan sát.
    - **Click đúp chuột trái (`Double-click`):** Mở **Bảng thuộc tính nổi (`Floating Inspector`)** gọn ở góc phải cho đúng mảnh (`1-A..1-F`), đầu kết nối (`C1`/`C2`), mí ghép hoặc cạnh tiếp giáp vừa click đúp (cũng mở được khi bấm thẻ `C1`/`C2` cột trái, nút `Chỉnh` trên thẻ đang chọn, hoặc lệnh mở chi tiết trong Menu chuột phải). Nhấn `Esc` để lần lượt đóng Menu → đóng Bảng nổi → bỏ chọn.
    - **Chuột phải tĩnh** (độ dịch chuyển `< 4 px` trên 3D để không xung đột với thao tác **giữ chuột phải kéo Pan** của OrbitControls) vào trực tiếp **Mảnh tôn (`1-A..1-F`)**, **Đầu kết nối (`C1` / `C2`)**, **Đường mí dọc (`TR / TL / BR / BL`)** hoặc **Cạnh tiếp giáp (`TL..BL`, `C1_*`, `C2_*`)** trên cả 3D và 2D sẽ mở **Menu ngữ cảnh CAD** tại vị trí trỏ chuột (gồm chuyển nhanh `Liền mảnh (Chấn 90°) ↔ Tách mảnh (Mí ghép)`, chỉnh kiểu kết nối, `Áp dụng giống nhau cho cả C1 & C2`, đổi kiểu mí, `Đảo mí kép ↔ mí đơn`, `Phóng to mảnh này`, và 2 mục chờ sẵn bị làm mờ `+ Trổ lỗ / Chân rẽ mặt này (Chặng sau)`, `+ Lớp bọc mặt này (Chặng sau)`).
  - **Vùng chính giữa (3D/2D Viewport):** Chuyển đổi giữa **`Xem 3D`**, **`Trải phẳng 2D`** (bản cắt Laser tỷ lệ 1:1 mm, xuất DXF chuẩn AutoCAD 2021 & Bodor Thinker) và **`Song song 3D + 2D`** (chia đôi màn hình đối chiếu trực tiếp, đồng bộ chọn mảnh/đầu nối/mí/cạnh hai chiều). Khi thu gọn cột trái, viewport tự động mở rộng 100% kèm nút nổi góc trên-trái để mở lại bảng điều khiển.
  - **Thanh công cụ nhanh phía trên Viewport:**
    - Chế độ hiển thị Viewport: `Xem 3D` | `Trải phẳng 2D` | `Song song 3D + 2D` (kiến trúc cắm-rút: chi tiết không có trải phẳng 2D chỉ cần vô hiệu hóa 2 nút 2D).
    - Chế độ vật liệu: `Tôn Mạ Kẽm` / `Inox` (tự động đồng bộ theo vật liệu đang chọn) ↔ `Tô màu kỹ thuật (Đỏ = Mí kép, Xanh dương = Mí đơn, Vàng = Bích/Đầu nối, Xanh lá = Đường chấn, Cam = Mí hàn)`.
    - Công tắc trạng thái mí: `Chưa gò mí (vừa chạy máy)` ↔ `Đã gò mí hoàn thiện`.
    - Thanh trượt `Tách mảnh (0% → 100%)` (tách rời các mảnh & phụ kiện/ke góc/đầu bịt; riêng cấu hình liền 1 mảnh như `1 mảnh (O)` hoặc khối gộp 1 mảnh tự do sẽ bung mở mượt các góc chấn quanh mặt gốc lên tới `24°` đồng bộ cùng ke góc/bịt đầu để quan sát rõ mí ghép).
    - Thanh trượt **`Mở phôi 3D (0% → 100%)`** (Gập thành phẩm `0%` ↔ Mở phẳng phôi trực tiếp trên 3D `100%`; kiến trúc cắm-rút qua cờ `unfoldSupported` để tự áp dụng cho nhóm phụ kiện vuông chấn phẳng và ẩn ở nhóm phụ kiện lốc tròn).
    - Công tắc bật/tắt **`Nhãn mặt (1-A, 1-B...)`** (mặc định BẬT).
    - Công tắc bật/tắt `Gân tăng cứng` (1 dạng gân thẳng duy nhất, chạy **song song 2 đầu bích C1 & C2**, bước theo `Cài đặt xưởng`, mặc định `210 mm`).
    - Nút `Đảo mí kép ↔ mí đơn` tự do.
    - Nút bánh răng **`Cài đặt xưởng`** mở Popup cấu hình máy móc & khổ tấm (lưu vĩnh viễn vào `localStorage`, cập nhật tức thì toàn bộ 3D, 2D và kiểm tra khổ tôn).

## 2. Yêu cầu Đồ họa 3D, Vật liệu, Gân tăng cứng & Cài đặt xưởng
- **Vật liệu 3D theo chủng loại vật liệu:**
  - **`Tôn Mạ Kẽm` (hoa nhỏ — khổ chuẩn mặc định `1200 × 6000 mm`):** Tạo texture thủ tục (procedural canvas `map` + `roughnessMap` + `bumpMap` nhẹ) mô phỏng đúng **tôn mạ kẽm hoa nhỏ (mini-spangle)**: tông bạc xám lạnh tự nhiên, các hạt tinh thể hoa kẽm kích thước nhỏ và mịn, độ phản chiếu kim loại sắc nét (`metalness: 0.80–0.85`).
  - **`Inox` (khổ chuẩn mặc định `1250 × 6000 mm`):** Bề mặt Inox sáng đồng đều, không có hoa kẽm. Trên giao diện chỉ ghi đúng **`Inox`** (không dùng các từ mô tả thừa như `xước mịn`, `xước mờ`).
- **Môi trường 3D tương phản nổi bật chi tiết:**
  - Nền viewport 3D dùng **studio tối dịu tương phản cao** (gradient xám xanh đậm `#1c2432` → `#0f141d`) kèm sàn lưới kỹ thuật mờ nhẹ.
  - Hệ ánh sáng studio 3 điểm + HDRI softbox phản chiếu + đèn rim-light bắt sáng các cạnh bẻ, kết hợp đường viền cạnh rất mảnh (`Edges`) giúp mọi nếp gấp mí, rãnh bích, khe hở góc và gân thẳng nổi khối rõ ràng.
- **Đánh dấu mảnh/mặt trong lòng ống (`1-A`, `1-B`, `1-C`, `1-D`, `1-E`, `1-F`...) & Chọn trực tiếp:**
  - Gán mã định danh chuẩn theo thứ tự cho từng mảnh: `1 mảnh` gồm `1-A`; `2 mảnh L` gồm `1-A`, `1-B`; `2 mảnh U+I` gồm `1-A`, `1-B`; `4 mảnh` gồm `1-A`, `1-B`, `1-C`, `1-D`; mảnh bịt đầu rời hoặc mảnh gộp trong chế độ tự do được đánh mã tuần tự sạch sẽ (`1-A`, `1-B`, `1-E`, `1-F`...).
  - Hiển thị chữ đánh dấu (`1-A`, `1-B`...) sắc nét ngay trên **mặt đánh dấu (lòng trong)** của từng mảnh tôn trong không gian 3D (chỉ đánh dấu tên mảnh trong lòng, **KHÔNG** chèn chữ ghi chú lên các đường mí hay mép bích).
  - Click trái chọn nổi bật đồng bộ 3D ↔ 2D; click đúp mở `Floating Inspector`; chuột phải tĩnh mở `Context Menu`.
- **Gân tăng cứng & Chiều kiểm tra khổ máy lăn gân (chuẩn thực tế xưởng):**
  - Chỉ sử dụng **1 dạng gân thẳng** duy nhất (tuyệt đối không vẽ gân chéo chữ X).
  - **Hướng chạy gân (trên cả 3D và 2D):** Các đường gân tăng cứng **LUÔN chạy song song với 2 đầu bích kết nối `C1` và `C2`** (chạy dọc theo chu vi / chiều rộng triển khai `B_phôi` của tấm phôi, vuông góc với chiều dài ống `L` / `L_phôi`).
  - **Bước gân cấu hình qua `Cài đặt xưởng` (mặc định `210 mm`):** Khoảng cách tâm–tâm giữa 2 đường gân liền kề = `ribPitchMm` (mặc định `210 mm`), căn đối xứng từ giữa chiều dài `L` ra hai đầu, giữ khoảng hở an toàn tối thiểu `90 mm` mỗi đầu để không dập gân đè lên vùng bích/mí đầu ống (ống ngắn `L < 220 mm` tự động bỏ qua gân).
  - **Chiều kiểm tra khổ máy lăn gân (`rollFormerLimitMm`, mặc định `1900 mm`):** Khi đưa tấm phôi vào máy lăn gân, các trục con lăn đi theo chiều dài đường gân nên **khổ lòng máy lăn gân CHỈ kiểm tra theo chiều vuông góc với đường gân — tức là tổng chiều dài phôi `L_phôi` (`blankLength`)**, **TUYỆT ĐỐI KHÔNG** kiểm tra theo chiều rộng triển khai chu vi `B_phôi` (`developedWidth`). Ví dụ ống `500 × 500, L = 1110`, 1 mảnh 2 đầu Nẹp C có `B_phôi = 2038 mm` và `L_phôi = 1135 mm` → hoàn toàn **ĐẠT** máy lăn gân (`1135 ≤ 1900`), không báo vượt khổ máy lăn gân dù `2038 > 1900`.
- **Popup `Cài đặt xưởng / Máy móc` (lưu bền vững `localStorage`):**
  - Cho phép người dùng tinh chỉnh trực tiếp các thông số máy móc & vật liệu xưởng (có nút `Khôi phục mặc định`):
    1. `Khổ máy lăn gân tối đa`: mặc định **`1900 mm`** (khoảng hợp lệ `500–4000 mm`).
    2. `Khoảng cách bước gân tăng cứng`: mặc định **`210 mm`** (khoảng hợp lệ `80–600 mm`).
    3. `Khổ tấm Tôn Mạ Kẽm`: Rộng mặc định **`1200 mm`** × Dài mặc định **`6000 mm`**.
    4. `Khổ tấm Inox`: Rộng mặc định **`1250 mm`** × Dài mặc định **`6000 mm`**.
  - Mọi thay đổi áp dụng ngay lập tức cho 3D (mật độ gân), 2D (đường gân, đường giới hạn khổ tấm & máy lăn gân), tự động chia mảnh và bảng kiểm tra `S Phôi`.

## 3. Thông số hình học & Quy chuẩn nhà máy (Ống thẳng — đối chiếu `REF_NOTES.md`)
### 3.1. Kích thước cơ bản & Chủng loại vật liệu
- `W` (Rộng, mm), `H` (Cao, mm), `L` (Dài, mm): hỗ trợ nhập tay mượt mà từ bàn phím và nút `-`/`+` theo **Bước nhảy** tùy chọn (`10` | `50` | `100 mm`, mặc định `50 mm`, hoặc gõ số tùy ý).
- **Vật liệu & Độ dày chuẩn (`t`):**
  - **Tôn Mạ Kẽm:** Độ dày `0.58, 0.75, 0.95, 1.15, 1.2, 1.5 mm`; khổ tấm mặc định **`1200 × 6000 mm`** (tùy chỉnh trong `Cài đặt xưởng`).
  - **Inox:** Độ dày `0.6, 0.8, 1.0 mm` (tự động chọn `0.8 mm` khi chuyển từ độ dày không thuộc danh sách Inox); khổ tấm mặc định **`1250 × 6000 mm`** (tùy chỉnh trong `Cài đặt xưởng`).
- **Quy ước chiều bẻ theo mặt tôn:**
  - `Mặt đánh dấu` là **mặt trong lòng ống** (hiển thị nhãn `1-A`, `1-B`... trên lòng trong 3D và trên bản vẽ trải phẳng 2D).
  - Mí đơn, LCCT, đường chấn góc thân ống đều bẻ vuông góc 90° **vào phía lòng trong (mặt đánh dấu)**.
  - Bích `TDC/TDF` bẻ vuông góc **ra ngoài (ngược chiều mặt đánh dấu)**; rãnh Mí kép Pittsburgh nằm bên **mặt ngoài (mặt không đánh dấu)**.

### 3.2. Thư viện Mí ghép (Seams) — Áp dụng cho cả thân ống & đầu bịt kín
1. **Mí gò Pittsburgh (Mặc định cho tất cả độ dày đến `1.5 mm` — nâng cấp biên dạng cán máy 3D sát `REF_NOTES.md`):**
   - **Mí kép (Female - màu đỏ):** Tôn thừa phôi `+31 mm`. Dựng 3D biên dạng rãnh cán máy 6 đoạn chân thực (vai nâng tạo khe cắm rõ ràng, lòng rãnh hở sâu cho phép nhìn rõ khe cắm ở trạng thái `Chưa gò mí`, thành ngoài có gờ cán nổi cứng, tai khóa mí 2 nấc đứng mở khi `Chưa gò mí` và bẻ gập ép bẹt 90° ôm khít gọn góc khi `Đã gò mí`).
   - **Mí đơn (Male - màu xanh dương):** Tôn thừa phôi `+7 mm`, **vát góc nhẹ `8°` (trong khoảng `5°–10°`, thụt vào `~1 mm` trên bề rộng `7 mm`)** ở 2 đầu trên cả 3D, 2D và DXF. Dựng gờ bẻ vuông góc 90° quay vào lòng trong.
   - **Hai trạng thái hiển thị:**
     - *Chưa gò mí:* Rãnh mí kép mở rõ khe cắm, mép gập ngoài đứng mở, mí đơn tách nhẹ để quan sát rãnh cắm.
     - *Đã gò mí:* Mí đơn cắm lọt lòng rãnh mí kép, mép ngoài của mí kép gập 2 nấc khóa chặt lên mí đơn.
2. **Mí hàn (Tùy chọn thay thế tự do cho MỌI đường mí hiện có):**
   - Người dùng có thể tự do chuyển đổi bất kỳ đường mí đơn/mí kép nào (toàn bộ thân ống, từng góc ghép dọc thân qua click đúp/chuột phải trực tiếp lên đường mí, hoặc từng cạnh ghép của **Đầu bịt kín**) sang **Mí hàn** khi không chạy được mí gò.
   - Hỗ trợ 2 kiểu chuẩn hóa: **`Hàn chập`** (nhập độ rộng tự do `7–25 mm`, mặc định `10 mm`) và **`Hàn đấu đầu`** (`0–0`).
   - Nếu `L < 140 mm`: hiển thị gợi ý nhẹ nên chuyển sang Mí hàn (vẫn cho phép người dùng tự chọn).
3. **Nối C (`17 + 17 mm` — ghi nhận từ `REF_NOTES.md` cho chặng mở rộng nối khúc):** Dành cho tấm vượt khổ vật liệu chuẩn (`W_tấm × L_tấm`) hoặc vượt giới hạn máy lăn gân (`rollFormerLimitMm`); phần đầu nối `+17 mm` tại 2 góc có bậc thụt vuông nhỏ nối ra biên chính bằng đoạn vát xéo ~45°.

### 3.3. Quy tắc chia mảnh, Kiểm tra Khổ Tấm Chuẩn Xưởng & Chế độ `Ghép mảnh tự do` (Đồ thị Mặt – Cạnh)
- **Kiểm tra vừa khổ tấm (`W_tấm × L_tấm`, mặc định `1200 × 6000` Tôn Mạ Kẽm / `1250 × 6000` Inox):**
  - Gọi 2 kích thước khung bao của mỗi mảnh phôi phẳng là **`B_phôi`** (chiều rộng triển khai) và **`L_phôi`** (tổng chiều dài phôi).
  - Một mảnh phôi được đánh giá là **`ĐẠT` (trạng thái xanh `ok`, KHÔNG báo vàng/đỏ)** khi thỏa mãn **1 trong 2 hướng cắt trên tấm**:
    1. **Cắt ngang khổ tấm (0°):** `L_phôi ≤ W_tấm` VÀ `B_phôi ≤ L_tấm` → nhãn **`Đạt — Cắt ngang khổ W_tấm`**.
    2. **Xoay dọc tấm (90°):** `B_phôi ≤ W_tấm` VÀ `L_phôi ≤ L_tấm` → nhãn **`Đạt — Xoay dọc tấm W_tấm×L_tấm`**.
  - Chỉ báo **`VƯỢT KHỔ` (trạng thái đỏ `danger`)** khi **cả hai cạnh đều vượt `W_tấm`** (`min(B_phôi, L_phôi) > W_tấm`) HOẶC **cạnh dài vượt `L_tấm`** (`max(B_phôi, L_phôi) > L_tấm`).
- **Tự động đề xuất chia mảnh theo khổ tấm xưởng đang cấu hình:**
  - `1 mảnh` (`1-A`): Chu vi `2*(W+H) ≤ 2400 mm` và `L_phôi ≤ W_tấm` (và `B_phôi ≤ L_tấm`).
  - `2 mảnh chữ L` (`1-A`, `1-B`): `2*(W+H) > 2400 mm`, `(W+H) ≤ 3000 mm`, và `L_phôi ≤ W_tấm`. Mặc định cạnh lớn hơn mang **Mí kép**, cạnh nhỏ hơn mang **Mí đơn**.
  - `2 mảnh chữ U+I` (`1-A`, `1-B`): Cho phép chọn thủ công để so sánh.
  - `4 mảnh` (`1-A`, `1-B`, `1-C`, `1-D`): `(W+H) > 3000 mm`, HOẶC khi `L_phôi > W_tấm` mà các mảnh đơn `W + mí ≤ W_tấm` và `H + mí ≤ W_tấm` (xoay dọc tấm `W_tấm × L_tấm`).
- **Chế độ `Ghép mảnh tự do` (Face–Edge Graph cho chi tiết 4–5–6 mặt kín & đào tạo triển khai):**
  - Bật/tắt qua nút **`Ghép tự do`** ngay cạnh mục `Chia mảnh` (hoặc chuột phải / click đúp trực tiếp lên bất kỳ cạnh tiếp giáp nào trên 3D & 2D).
  - Mỗi cạnh tiếp giáp giữa 2 mặt kề nhau (`TL`, `TR`, `BR`, `BL` của thân ống; `C1_top..C1_right` của đầu bịt C1; `C2_top..C2_right` của đầu bịt C2) đều có 2 trạng thái độc lập:
    - **`Liền mảnh (Chấn 90°)`** *(màu xanh lá)*: Gộp 2 mặt thành một tấm tôn liền, có đường chấn 90° tại cạnh chung.
    - **`Tách mảnh (Mí ghép / Hàn)`** *(màu vàng cam)*: Tách rời bằng mí gò Pittsburgh hoặc mí hàn tùy chọn.
  - **Bảo vệ vòng kín tự động (`Cycle Guard` / `Spanning Tree`):** Kiểm tra đồ thị bằng thuật toán BFS/Union-Find trước khi gộp cạnh; nếu nối cạnh mới sẽ tạo thành vòng kín không thể trải phẳng, hệ thống chặn lại và hiển thị thông báo rõ ràng *"Không thể nối kín vòng — cần tách ít nhất 1 cạnh để trải phẳng"* kèm nút **1 click tự tách cạnh đối diện/gợi ý & gộp cạnh đang chọn**.
  - **Tự kiểm tra chồng lấn phôi 2D (`hasOverlap2D`):** Khi trải phẳng một cây mảnh tự do có các mặt bị đè nhau trên mặt phẳng 2D, hệ thống tự động phát hiện, tô khung viền cam + vùng gạch chéo cam ngay trên bản vẽ 2D (và bản in PDF) đồng thời hiện cảnh báo trong tab `S Phôi`.
  - **Preset đào tạo 5 mặt nhanh:** `Gộp Bịt C1 + Trên` (gộp đầu bịt kín C1 liền với mặt Trên qua 1 đường chấn), `Chữ thập 5 mặt` (mặt Bịt C1 ở giữa mở liền cả 4 vách thân xung quanh), `Đặt lại`.
  - **Đồng bộ 100% toàn hệ thống:** Mọi thay đổi ghép/tách mảnh cập nhật tức thì trên 3D, hoạt ảnh **`Mở phôi 3D`** (đầu bịt mở liền theo đúng mặt gắn), bản vẽ **2D** (gộp thành 1 đường cắt `CUT` khép kín duy nhất kèm đường chấn ngang/dọc), xuất **DXF**, diện tích **`S Phôi`** và kiểm tra khổ **`1200×6000` / `1250×6000`**.

### 3.4. Thư viện Đầu kết nối (Chọn độc lập cho Đầu C1 và Đầu C2 — qua thẻ C1/C2 hoặc click đúp/chuột phải trực tiếp trên 3D/2D)

#### A. Nhóm Bích liền thân ống
1. **`TDC/TDF` (Gộp chung làm một lựa chọn duy nhất — đối chiếu thực tế xưởng `REF_NOTES.md`):**
   - Phôi tôn thừa `+48 mm`, khấu góc tổng `60 mm` (khấu sâu thêm `12 mm` vào thân).
   - **Hình học 3D mặt bích & ke góc chuẩn xưởng:**
     - Chiều cao mặt bích 3D hoàn thiện **`32 mm`**, biên dạng gập hộp chữ C kèm **gân giật bậc dọc chính giữa mặt bích** và **mép cuốn J-return sát mặt sau** tạo rãnh kẹp chân ke góc; khe hở tại 4 góc ống khít thực tế (`~2 mm`).
     - **4 ke góc 3D bằng tôn mạ kẽm dập định hình sát ảnh xưởng (`ke_góc_1.jpg`, `ke_góc_cận_cảnh.jpg`, `ke_góc_đã_đóng.jpg`):** tấm góc mặt trước giật cấp nằm **đồng mặt phẳng** với mặt bích TDC, 2 chân thụt cấp luồn sâu vào rãnh kẹp mặt bích có **gân tăng cứng dập nổi dọc chân**, **ngạnh giữ** và **đầu cắt vát chéo ngoài**; **lỗ bulong hình giọt nước có đầu nhọn V quay vào phía góc trong lòng ống và cung tròn hướng ra góc ngoài bích**, trượt rời khi kéo `Tách mảnh`.
   - **Không có vết khấu tam giác ở giữa cạnh dài mặt bích.**
   - Tùy chọn **`Dấu lõm phân biệt đầu (TDF)`** (mặc định TẮT với ống thẳng): khi bật, cắt **1 vết lõm chữ V tam giác nhỏ nằm ngay trên cạnh bên của tai bích `+48 mm`** (đồng bộ giữa 3D và 2D/DXF theo `Bích_TDF_trên_bản_vẽ_với_vết_v_lõm.png` & `bích_TDF_khấu_v_lõm_thực_tế.jpg`).
2. **`Nẹp C` (Bích liền thân ống, KHÔNG vẽ thanh cài rời màu vàng):**
   - Phôi cộng `+12.5 mm`, khấu góc `25 mm`.
   - **Vát góc ngoài mép Nẹp C (`3.5 mm` — đồng bộ 2D, DXF và 3D):** Tại góc ngoài ở đầu mép `Nẹp C` (`+12.5 mm`, chỗ giao cạnh đỉnh đầu ống với mép cắt dọc), vát chéo nhẹ vào trong **`3.5 mm`** (trong khoảng `3–4 mm`) thay vì để góc nhọn vuông `90°` thừa ra.
   - Phần tôn thừa `+12.5 mm` liền với thân ống được **uốn cong vòng 180° mượt 6 đoạn ra ngoài tạo rãnh hình chữ C** có khe hở lòng chữ C rõ nét; cả 4 cạnh Nẹp C **chạy sát ra tận mép góc của từng mặt ống** (chỉ chừa khe hở kỹ thuật `~1.5 mm` tại giao điểm 90° của 4 góc để 2 mép không cấn nhau, đồng bộ 3D và 2D theo `nẹp_C.jpg`).
3. **`Đầu bẻ chân` (Tùy biến độc lập từng cạnh):**
   - Chiều rộng bẻ chân `F` nhập tay tự do (mặc định `20 mm`), phôi cộng `+F mm` cho các mảnh có cạnh bẻ (`+0 mm` nếu mảnh chỉ gồm cạnh để thẳng).
   - Cho phép tùy chỉnh độc lập 4 cạnh **`Trên / Dưới / Trái / Phải`** với 3 trạng thái: **`Bẻ vào` | `Bẻ ra` | `Để thẳng`**, kèm 5 nút chọn nhanh (Preset).
   - **Ghép góc thực tế cho `Bẻ vào` (`bẻ_chân_vào_trong_1.jpg`):** Tại góc giao giữa 2 cạnh cùng bẻ vào 90°, **ghép vuông đối đầu gọn (square butt-joint)** — 2 cạnh trên/dưới phủ hết chiều rộng `W`, 2 cạnh đứng trái/phải cắt vuông lùi `F` áp sát vào mặt trong cạnh kề (không cắt hở chéo 45° lớn), đồng bộ trên cả 3D và 2D/DXF.
4. **`Lưới chắn côn trùng (LCCT)`:**
   - Phôi cộng `+20 mm`, chấn vuông góc 90° quay vào lòng trong, kèm nút bật/tắt hiển thị **khung lưới ô vuông có nẹp chia ô** bên trong.
5. **`Đầu bịt kín (End Cap)`:**
   - Mặc định 4 cạnh đầu thân ống chạy **Mí kép chờ (`+31 mm`)** và sinh **Mảnh bịt đầu rời (`1-B` / `1-E` / `1-F`...)** có 4 cạnh **Mí đơn (`+7 mm`, vát góc nhẹ `8°`)** cùng gân thẳng song song (bước theo `Cài đặt xưởng`, mặc định `210 mm`).
   - Hỗ trợ tự do chuyển đổi toàn bộ hoặc từng cạnh (`Trên / Dưới / Trái / Phải`) sang **`Hàn chập`** (`7–25 mm`) hoặc **`Hàn đấu đầu`** (`0–0`), hoặc **gộp liền tấm** với bất kỳ mặt thân ống nào qua chế độ `Ghép tự do`.
6. **`Đầu để thẳng` (Đoạn trơn không chạy mí):**
   - Bổ sung ô nhập tay **Chiều dài đoạn để thẳng `L_thẳng`** (`0, 20, 30, 40 mm...`, mặc định `0 mm`; bù phôi `+L_thẳng mm`).
   - **Quy tắc bắt buộc:** Trên suốt chiều dài đoạn để thẳng mở rộng (`L_thẳng > 0`), thân ống **để thẳng trơn hoàn toàn, KHÔNG chạy mí** (đường mí ghép dọc thân dừng lại trước đoạn để thẳng).

#### B. Nhóm Bích rời (KHÔNG vẽ lỗ, ghép vuông góc 2 thanh phủ bì + 2 thanh lọt lòng — nâng cấp 3D sát `REF_NOTES.md`)
- **Quy tắc ghép góc bắt buộc cho cả Bích V & Bích U:** Không cắt vát chéo 45° trên mặt phẳng khung bích. Khung bích chữ nhật được ghép vuông góc từ **2 thanh có chiều dài phủ bì** và **2 thanh có chiều dài lọt lòng**; bo tròn góc trong chân thép cán thật (root fillet), và chỉ **vát chéo 45° tránh cấn ở phần thừa đuôi cánh ôm phía sau**. **Không vẽ lỗ** trên cả Bích V lẫn Bích U.
7. **`Bích V quay ngoài` (Rời):**
   - Quy cách: `V30×30`, `V40×40`, `V50×50`, `V80×30`; độ dày `2 / 3 / 4 mm`.
   - *`V30/V40/V50` ống thường:* Lòng trong khung V = `W+5 × H+5`; phôi thân ống cộng **`+8 mm`** bẻ lật 90° ôm mép bích, khấu góc `= V + 5`.
   - *`V30/V40/V50` ống EI:* Lòng trong khung V = `W-3 × H-3`; phôi thân ống cắt thẳng **`+0 mm`**, khấu EI `= V + 5`.
   - *Quy cách đặc biệt **`V80×30`**:* Luôn quay ngoài (cánh `80 mm` làm mặt bích), phần cánh `30 mm` đặt **lọt vào trong lòng chi tiết**, nên kích thước khung bích **giảm `-3 mm` mỗi chiều (`W-3 × H-3`)** giống hệt bích V quay trong; phôi thân ống cắt thẳng **`+0 mm`**.
8. **`Bích V quay trong` (Rời — thay thế hoàn toàn TDC/TDF quay trong):**
   - Quy cách: `V30×30`, `V40×40`, `V50×50`; độ dày `2 / 3 / 4 mm`.
   - Phủ bì khung V = **`W-3 × H-3`**; phôi thân ống cắt thẳng **`+0 mm`**.
9. **`Bích U rời`:**
   - Độ dày `1.5 / 2 / 3 mm`, phôi thân ống cắt thẳng **`+0 mm`**.
   - Mặt cắt chữ U lệch cánh có bo góc trong chân chấn: Cánh ôm thân ống (mặc định `30 mm`, đổi tự do) × Mặt bích phẳng (mặc định `40 mm`, đổi tự do) × **Gờ bẻ ngoài cố định `10 mm` quay ngược về phía thân ống chạy liên tục phủ kín 4 góc vuông ngoài**, ghép 2 thanh phủ bì + 2 thanh lọt lòng và vát 45° tránh cấn ở đuôi cánh ôm.

### 3.5. Phụ kiện gắn kèm, Lỗ trổ & Chi tiết gia công trên thân ống (Chặng kế tiếp)
- **Tyren tăng cứng (`M8 / M10`):** Nhập số lượng và vị trí khoảng cách từ đầu C1 (hoặc chia đều tự động). Dựng thanh ren xuyên ống kèm lỗ khoan trên 2 mặt đối diện và ecu/long đen.
- **Lỗ trổ & Phụ kiện gắn lên 4 mặt (`Trên / Dưới / Hông trái / Hông phải`):**
  - *Chân rẽ vuông / Chân rẽ vát (Shoe):* Nhập kích thước đáy `W1×H1`, đầu ra `W2×H2`, chiều dài `L_branch`, chiều rộng bẻ chân (ví dụ `20 mm`), bích đầu ra (`TDC/TDF / Nẹp C / Để thẳng`), hướng vát (`Về C1 / Về C2 / Cân tâm`), khoảng cách từ đầu C1.
  - *Chân rẽ vuông tròn / Cổ tròn:* Tự động áp quy chuẩn nhà máy **giảm `5 mm` đường kính cổ** (ví dụ `D200 → D195`, có công tắc tắt nếu LSX ghi "làm đúng D"), dựng gân tròn trên cổ và tai bẻ chân.
  - *Cửa thăm / Lỗ trổ trống / Tai treo / Fin lọc G4:* Khoét lỗ vuông/tròn/oval đúng vị trí trên mặt tôn (cả trên 3D và phôi trải phẳng 2D).
- **Ống tiêu âm / Lớp bọc bảo ôn (tùy chọn bật/tắt):** Bông khoáng dày `25 / 50 / 100 mm` + lớp tôn soi lỗ (`H23 bẻ 15`, `H45 bẻ 20`, `H95 bẻ 20`), hỗ trợ chế độ cắt mặt cắt để soi lớp tiêu âm bên trong.

### 3.6. Chế độ nhập LSX & Tham chiếu bản vẽ
- **Parser Tiếng Việt:** Nhận diện các mẫu chuẩn như:
  - `Ống gió KT: 500x320, L1100, tôn 0.75, 2 đầu bích TDC/TDF`
  - `Ống gió Inox KT: 700x400, L1200, dày 0.8, 2 đầu nẹp C`
  - `Ống gió KT: 800x500, L1000, tôn 0.95, 2 đầu bích V80x30`
  - `Ống gió KT: 600x350, L950, tôn 0.75, 1 đầu bích TDC, 1 đầu để thẳng +40`
- Hỗ trợ nút **Nhập/Xuất JSON** để nạp nhanh toàn bộ thông số ống (bao gồm cả cấu hình `freeMergeMode` & `customEdgeStates`).

## 4. Chế độ Trải phẳng phôi 2D & Xuất DXF chuẩn AutoCAD 2021 / Bodor Thinker — Kiến trúc Mở & Cắm-Rút
- **Kiến trúc độc lập & cấu trúc biên dạng mở (`EditableContour2D` → `FlatPattern2DViewer` + `dxfExporter`):**
  - Tách riêng kiểu dữ liệu 2D ([flatPattern2d.ts](file:///home/antigravity/EUSTEEL/DUCT3D/src/types/flatPattern2d.ts)), bộ trải phẳng 2D ([flatPattern2D.ts](file:///home/antigravity/EUSTEEL/DUCT3D/src/domain/flatPattern2D.ts)), bộ xuất DXF ([dxfExporter.ts](file:///home/antigravity/EUSTEEL/DUCT3D/src/domain/dxfExporter.ts)) và trình xem 2D ([FlatPattern2DViewer.tsx](file:///home/antigravity/EUSTEEL/DUCT3D/src/components/FlatPattern2DViewer.tsx)) hoàn toàn độc lập với Three.js.
  - **Biên dạng cắt lưu dạng cấu trúc đỉnh/đoạn có thể chỉnh sửa (`outerContour: EditableContour2D` gồm mảng `vertices` và `segments` gắn thẻ đặc trưng `male_bevel`, `nep_c_chamfer`, `tdc_notch`...)** thay vì ghép chuỗi đường vẽ cứng — sẵn sàng cho công cụ vẽ và tinh chỉnh góc vát/khấu trực tiếp trên 2D ở các chặng sau.
  - Trình duyệt render vector sắc nét chạy ngầm để zoom/pan mượt trên cả PC lẫn điện thoại; trên giao diện **KHÔNG** hiển thị nút tải SVG hay chữ "SVG".
  - Mọi phụ kiện/chi tiết có trải phẳng sau này chỉ cần sinh mảng `FlatPatternPiece` (kèm tùy chọn lỗ khoét `innerContours`/`innerHoles`) để cắm thẳng vào `FlatPattern2DViewer` & bộ xuất DXF; chi tiết nào không cần 2D chỉ cần đặt `flatPatternSupported = false` để vô hiệu hóa nút 2D mà không ảnh hưởng hệ thống.
- **Chuyển chế độ & Tương tác Viewport 2D:**
  - Cụm 3 nút trên thanh công cụ: **`Xem 3D`** | **`Trải phẳng 2D`** | **`Song song 3D + 2D`** (chia đôi màn hình 50/50 để vừa xoay 3D vừa đối chiếu bản cắt Laser 2D).
  - Trình xem 2D hỗ trợ **Zoom bằng con lăn chuột theo tâm trỏ**, **kéo Pan di chuyển**, nút **`Vừa màn hình` (Fit)**, **click đơn** để chọn nổi bật, **click đúp** để mở `Floating Inspector`, và **chuột phải** mở `Context Menu` trực tiếp lên mảnh (`1-A..1-F`), vùng đầu `C1`/`C2`, vùng mí dọc và các **cạnh đường chấn/tiếp giáp** đồng bộ hai chiều 2D ↔ 3D (kèm lệnh **`Phóng to mảnh này`** tự căn zoom vừa mảnh).
- **Biên dạng cắt Laser 1:1 mm (Chuẩn xưởng theo `REF_NOTES.md` — Mặt nhìn: `MẶT ĐÁNH DẤU — Lòng trong ống`):**
  - Tự động vẽ đủ mọi mảnh theo chế độ chia chuẩn (`1 mảnh O`, `2 mảnh L`, `2 mảnh U+I`, `4 mảnh`, mảnh bịt đầu rời) **và** chế độ `Ghép tự do` (gộp các mặt liền mạch trên cây thành 1 đường bao cắt khép kín `CUT` duy nhất kèm đường chấn ngang/dọc).
  - **`TDC/TDF` (chuẩn bản vẽ & phôi thật `bích_TDC_thực_tế_trên_bản_vẽ.png` / `Bích_TDF_trên_bản_vẽ_với_vết_v_lõm.png` / `phần_khấu_bẻ_giữa_các_mặt,_rộng_2_mm.jpg` — đồng bộ 100% giữa 2D và DXF):**
    - Tổng tôn thừa bích `+48 mm`, khấu sâu vào thân `12 mm` (tổng chiều dài vùng khấu `60 mm`).
    - **Góc khấu biên ngoài tại mép mí dọc:** từ mép ngoài mí dọc (`+31 mm` mí kép / `+7 mm` mí đơn / hàn chập) cắt **bậc vuông góc 90° sắc nét** đi ngang vào trong tới biên thân (tại vị trí lùi `12 mm` vào thân) → chạy thẳng dọc `12 mm` tới ranh giới đầu thân `yBody` → **bậc giật chuyển tiếp siêu nhỏ `~1.5 mm` vào trong** → cạnh bên tai bích `+48 mm` chạy thẳng song song gặp biên ngang ngoài ở góc **90° sắc nét**.
    - **Vết V lõm phân biệt đầu TDF (`showEndIndent = true`):** cắt **1 vết chữ V lõm tam giác nhỏ nằm ngay trên cạnh bên của tai bích `+48 mm`** (cách mép ngoài `~18 mm`, sâu `~3.5 mm`, rộng miệng `~6 mm`).
    - **Khe khấu tại đường chấn 90° giữa các mặt ống:** **khe xẻ song song rất hẹp rộng đúng `2 mm`** (`±1 mm` quanh đường chấn), chạy thẳng từ mép ngoài `+48 mm` sâu vào `12 mm` trong thân rồi kết thúc bằng **mũi nhọn V nhỏ** đúng trên tâm đường chấn.
  - **`Nẹp C`:** Bù `+12.5 mm`, khấu góc tổng `25 mm` (`12.5 + 12.5 mm`) với khe hở kỹ thuật góc sát thực tế `~1.5–1.8 mm` và **vát góc ngoài vào trong `3.5 mm` tại đầu mép Nẹp C** (`nẹp_C.jpg`).
  - **`Bích V`:** `V30/V40/V50` ống thường bù `+8 mm` và khấu mí vuông `= V + 5` kèm **bậc lõm nhỏ `~1.5 mm` ngay sát góc nhọn ngoài của mép bẻ `+8 mm`**; `Bích V EI` bù `+0 mm` khấu góc `= V + 5`; `V80×30` cắt thẳng `+0 mm`; `Bích V quay trong` bù `+0 mm` kèm khấu mí `= V + 5`.
  - **`Bích U`:** Cắt thẳng `+0 mm`.
  - **`LCCT`:** Bù `+20 mm`, vát góc 45° gọn 4 góc để chấn 90° vào lòng trong.
  - **`Bẻ chân`:** Theo từng cạnh độc lập (`Bẻ vào` ghép vuông đối đầu chuẩn xưởng `bẻ_chân_vào_trong_1.jpg`: cạnh trên/dưới phủ đủ `W`, cạnh trái/phải lùi vuông `F` tại góc giao với cạnh bẻ vào kề bên; `Bẻ ra` bù `+F` khấu góc vuông; `Để thẳng` cắt phẳng `+0 mm`).
  - **`Để thẳng` (`+L_thẳng > 0`):** Vẽ đủ chiều dài đoạn kéo dài trơn hoàn toàn, thể hiện rõ **mí ghép dọc thân kết thúc trước đoạn kéo dài** (`0 mm` mí trên đoạn kéo dài).
  - **`Đầu bịt kín`:** Đầu thân ống bù `+31 mm` (mí kép chờ) trên các cạnh chạy mí gò; mảnh bịt rời vẽ `W × H` cộng 4 cạnh **Mí đơn `+7 mm` vát góc nhẹ `8°`** (hoặc tự đổi sang `Hàn chập` / `Hàn đấu đầu` theo cấu hình từng cạnh, hoặc gộp liền vào thân qua `Ghép tự do`).
  - **Mí dọc thân:** Mí kép `+31 mm` (nét đứt ranh giới, tô đỏ nhạt ở chế độ Màu kỹ thuật); **Mí đơn `+7 mm` vát góc nhẹ `8°` (`~1 mm` thụt vào ở 2 đầu, tô xanh dương nhạt)**; `Hàn chập` (`7–25 mm`, tô cam nhạt) & `Hàn đấu đầu` (`0 mm`).
- **Hiển thị kỹ thuật trên trình duyệt & Nút `In / Lưu PDF`:**
  - Vẽ đường chấn 90° nét đứt xanh lá (hỗ trợ cả đường chấn đứng và ngang cho mảnh gộp 5–6 mặt), **gân thẳng chạy song song 2 đầu bích C1 & C2** theo bước cấu hình xưởng (mặc định `210 mm`), nhãn tâm mảnh (`1-A`, `1-B`, `1-E`...) kèm `Mặt nhìn: MẶT ĐÁNH DẤU (Lòng trong ống)`, đường kích thước tổng & chi tiết, và **viền cam + gạch chéo vùng đè nhau** nếu mảnh gộp tự do có chồng lấn 2D.
  - **Đường giới hạn khổ vật liệu & máy lăn gân trên bản 2D:**
    - Đường khổ vật liệu tự động căn đúng theo hướng cắt hợp lệ: đường ngang `Khổ W_tấm` khi cắt ngang (0°), hoặc đường đứng màu xanh lá `Khổ W_tấm (Xoay dọc)` khi xoay dọc hợp lệ (90°), và chỉ báo đỏ khi thực sự vượt khổ cả 2 hướng.
    - Đường giới hạn máy lăn gân (`rollFormerLimitMm`, mặc định `1900 mm`) **CHỈ đặt theo phương ngang kiểm tra `L_phôi` (vuông góc đường gân)** — tuyệt đối không so với chiều rộng chu vi `B_phôi`.
  - Nút **`In / Lưu PDF`** chỉ sinh bản in nền trắng tại thời điểm người dùng bấm nút (đầy đủ kích thước, đường chấn, gân theo bước xưởng và nhãn `1-A, 1-B...` để in kẹp lệnh sản xuất hoặc gửi Zalo; không hiển thị `kg`).
- **Quy chuẩn xuất **`Tải file DXF`** (chuẩn AutoCAD 2021+ & Bodor Thinker 3.0):**
  - **Tên file tải về ngắn gọn theo thời gian:** **`YYYYMMDD_HHmmss.dxf`** (ví dụ `20261126_223500.dxf`).
  - **Định dạng ASCII DXF `AC1021` chuẩn thư viện `@tarikjabiri/dxf`:** đầy đủ 6 phần `HEADER` (`$ACADVER = AC1021`, `$INSUNITS = 4` đơn vị mm, `$MEASUREMENT = 1`, `$HANDSEED` hợp lệ), `CLASSES`, `TABLES` (handle duy nhất, `LAYER`, `STYLE`, `DIMSTYLE Standard`), `BLOCKS` (`*Model_Space`, `*Paper_Space` và các block ẩn danh `*D1..*Dn` cờ `70 = 1` dựng đầy đủ hình học hiển thị đường kích thước để mở sạch trên AutoCAD 2021 không báo lỗi và hiện đủ 100% số đo), `ENTITIES`, `OBJECTS`.
  - Tỷ lệ tuyệt đối **`1:1` (mm)**, **đã lật trục tọa độ Y hướng lên trên** chuẩn CAD; các mảnh tự động xếp thoáng cách đều **`20 mm`** không chồng đè.
  - **Chỉ chứa duy nhất 2 Layer thực thể:**
    1. **Layer `CUT`:** Duy nhất biên dạng cắt ngoài (đọc trực tiếp từ `outerContour.vertices`, cùng lỗ khoét `innerContours` ở các chặng sau) bằng đường đa tuyến khép kín **`LWPOLYLINE`** (`70 = 1`, không hở góc, không trùng nét).
    2. **Layer `DIM`:** Các đường kích thước tổng & cạnh chính xuất **bắt buộc bằng đối tượng `DIMENSION` chuẩn gốc DXF** liên kết block ẩn danh `*D1..*Dn`, tuyệt đối không để `LINE` hay `TEXT` rời ngoài `ENTITIES`.
  - **Loại bỏ 100% khỏi file DXF:** đường chấn nét đứt, đường gân tăng cứng, đường/khung giới hạn khổ tôn, mọi chú thích diễn giải và toàn bộ nhãn chữ lòng trong (`1-A`, `1-B`...).

## 5. Chế độ Mở phôi 3D (`Mở phôi 3D: 0% → 100%`) — Kiến trúc Bản lề Phân cấp 60fps
- **Vị trí & Cắm-rút:** Thanh trượt **`Mở phôi 3D`** (`0%` Gập thành phẩm → `100%` Mở phẳng phôi 3D) đặt cạnh `Tách mảnh` trên thanh công cụ phía trên Viewport; hỗ trợ cờ cắm-rút `unfoldSupported` (BẬT với ống thẳng & phụ kiện vuông chấn phẳng, TẮT/ẩn với phụ kiện lốc tròn).
- **Hiệu năng 60fps không tái tạo geometry:** Dựng sẵn cây bản lề phân cấp tổng quát 6 mặt ([geometry3D.ts](file:///home/antigravity/EUSTEEL/DUCT3D/src/domain/geometry3D.ts) → [DuctAssembly.tsx](file:///home/antigravity/EUSTEEL/DUCT3D/src/three/DuctAssembly.tsx)) với các pivot `Group` đặt chính xác tại từng trục đường chấn (dọc lẫn ngang) và đường gập. Khi kéo `Mở phôi 3D` hoặc `Tách mảnh`, chỉ cập nhật `quaternion`, `rotation`, `position` và độ mờ vật liệu chi tiết rời — **không** tạo lại `BufferGeometry`.
- **Trình tự chuyển động gập/mở chân thực (hỗ trợ cả 4 mặt chuẩn lẫn 5–6 mặt ghép tự do):**
  1. **`0% → 30%`:** Toàn bộ chi tiết rời không liền tôn (`4 ke góc TDC`, `Bích V rời`, `Bích U rời`, `Khung lưới LCCT`, `Mảnh bịt đầu rời` chưa gộp) tự trượt tách dọc trục ra xa và giảm độ mờ nhẹ (`1.0 → 0.28`) để tránh đâm xuyên khi các mặt tôn mở ra.
  2. **`0% → 100%`:**
     - Các mặt thân ống và **mặt Đầu bịt kín đã gộp liền qua `Ghép tự do`** (kể cả cấu hình `Gộp Bịt C1 + Trên` hoặc `Chữ thập 5 mặt`) xoay mở phẳng đồng thời `90° → 0°` quanh đúng các trục đường chấn về mặt phẳng ngang (lòng trong `MẶT ĐÁNH DẤU` hướng lên trên).
     - Toàn bộ nếp bẻ liền tôn (**`Mí đơn +7 mm` vát `8°`**, **chuỗi nếp gập 6 đoạn `Mí kép +31 mm`**, **`Hàn chập`**, **`Bẻ chân` từng cạnh**, **`LCCT +20 mm`**, **mép lật `+8 mm` Bích V thường**, **chuỗi gập `TDC/TDF +48 mm` kèm gân mặt bích & mép cuốn J**, **nếp uốn cong 180° 6 đoạn `Nẹp C +12.5 mm` kèm vát góc ngoài `3.5 mm`**, và **mí chờ đầu bịt kín**) xoay mở phẳng dần về `0°` thành tấm phôi phẳng 3D.
  3. Phối hợp hoàn hảo với **`Tô màu kỹ thuật`** (thấy rõ Đỏ = Mí kép, Xanh dương = Mí đơn, Vàng = Bích, Xanh lá = Đường chấn trải phẳng ngay trong không gian 3D) và hoạt động độc lập, không xung đột với `Tách mảnh`.