# SPEC MODULE 1: WEB APP 3D ỐNG GIÓ (EUSTEEL)

## 1. Mục tiêu & Kiến trúc tổng thể
- **Mục tiêu:** Web App 3D tham số hóa phục vụ đào tạo nhân sự kỹ thuật & sản xuất đọc hiểu cấu tạo thật của ống gió (mí ghép, bích kết nối liền thân và bích rời, đường chấn, vết khấu, chia mảnh theo khổ tôn `1200 mm` / Inox `1250 mm`, trổ lỗ gắn chân rẽ/cổ tròn/tyren).
- **Công nghệ:** React + Vite + TypeScript + Tailwind CSS + Three.js (`@react-three/fiber`, `@react-three/drei`). Chạy 100% phía trình duyệt (client-side), không cần backend, có thể build tĩnh đẩy lên GitHub Pages.
- **Ngôn ngữ giao diện:** 100% Tiếng Việt chuyên ngành cơ khí ống gió.
- **Bố cục màn hình:**
  - **Cột trái thu gọn (`320px`, hỗ trợ nút ẩn/hiện để xem 3D/2D toàn màn hình 100%):** 3 Tab:
    1. `Thông số` (giữ gọn tuyệt đối cho các thông số toàn cục: mục **`Cấu hình mẫu nhanh`** dạng accordion **mặc định đóng**, kích thước `W / H / L` kèm bước nhảy `10 / 50 / 100 mm`, vật liệu `Tôn Mạ Kẽm / Inox` & độ dày, 2 thẻ tóm tắt `Đầu C1` / `Đầu C2` click mở bảng nổi + nút `Áp dụng C1 → C2`, chế độ `Chia mảnh`, `Loại mí mặc định`, công tắc `Gân tăng cứng` theo bước cấu hình xưởng. Đã lược bỏ danh sách nút chọn mảnh 1-A/1-B, bảng cấu hình đầu kết nối dài và bảng sửa từng góc mí khỏi cột trái để tối ưu chiều cao cuộn).
    2. `Nhập LSX` (dán text LSX tiếng Việt, Nhập/Xuất thông số JSON, tự động chia mảnh theo khổ tấm xưởng đang cấu hình).
    3. `S Phôi` (tổng diện tích phôi `m²`, khổ tấm vật liệu đang cấu hình `W_tấm × L_tấm`, phân tích chiều dài phôi `L_phôi = L + bù C1 + bù C2`, bảng kích thước & diện tích `m²` từng mảnh `1-A, 1-B...`, trạng thái lọt khổ theo **cả 2 hướng đặt phôi 0° và xoay dọc 90°** và giới hạn máy lăn gân — **không hiển thị khối lượng kg**).
  - **Tương tác trực tiếp trên mô hình 3D & bản vẽ 2D (Context Menu chuột phải + Bảng thuộc tính nổi `Floating Inspector`):**
    - **Chuột phải tĩnh** (độ dịch chuyển `< 4 px` trên 3D để không xung đột với thao tác **giữ chuột phải kéo Pan** của OrbitControls) vào trực tiếp **Mảnh tôn (`1-A..1-F`)**, **Đầu kết nối (`C1` / `C2`)** hoặc **Đường mí dọc (`TR / TL / BR / BL`)** trên cả 3D và 2D sẽ mở **Menu ngữ cảnh CAD** tại vị trí trỏ chuột (gồm chỉnh nhanh kiểu kết nối, `Áp dụng giống nhau cho cả C1 & C2`, đổi kiểu mí, `Đảo mí kép ↔ mí đơn`, `Phóng to mảnh này`, và 2 mục chờ sẵn bị làm mờ `+ Trổ lỗ / Chân rẽ mặt này (Chặng sau)`, `+ Lớp bọc mặt này (Chặng sau)`).
    - **Click chuột trái** vào mảnh/đầu nối/mí trên 3D hoặc 2D (hoặc bấm thẻ `C1`/`C2` bên cột trái) sẽ tô sáng đồng bộ hai chiều 3D ↔ 2D và mở **Bảng thuộc tính nổi (Floating Inspector)** gọn ở góc phải để chỉnh sâu thông số cục bộ (loại bích, độ rộng bẻ chân từng cạnh, độ rộng hàn chập, kéo dài để thẳng, dấu lõm TDF...) mà không kéo dài cột trái. Nhấn `Esc` hoặc click vùng trống để đóng.
  - **Vùng chính giữa (3D/2D Viewport):** Chuyển đổi giữa **`Xem 3D`**, **`Trải phẳng 2D`** (bản cắt Laser tỷ lệ 1:1 mm, xuất DXF chuẩn AutoCAD & Bodor Thinker) và **`Song song 3D + 2D`** (chia đôi màn hình đối chiếu trực tiếp, đồng bộ chọn mảnh/đầu nối/mí hai chiều). Khi thu gọn cột trái, viewport tự động mở rộng 100% kèm nút nổi góc trên-trái để mở lại bảng điều khiển.
  - **Thanh công cụ nhanh phía trên Viewport:**
    - Chế độ hiển thị Viewport: `Xem 3D` | `Trải phẳng 2D` | `Song song 3D + 2D` (kiến trúc cắm-rút: chi tiết không có trải phẳng 2D chỉ cần vô hiệu hóa 2 nút 2D).
    - Chế độ vật liệu: `Tôn Mạ Kẽm` / `Inox` (tự động đồng bộ theo vật liệu đang chọn) ↔ `Tô màu kỹ thuật (Đỏ = Mí kép, Xanh dương = Mí đơn, Vàng = Bích/Đầu nối, Xanh lá = Đường chấn, Cam = Mí hàn)`.
    - Công tắc trạng thái mí: `Chưa gò mí (vừa chạy máy)` ↔ `Đã gò mí hoàn thiện`.
    - Thanh trượt `Tách mảnh (0% → 100%)`.
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
  - Gán mã định danh chuẩn theo thứ tự cho từng mảnh: `1 mảnh` gồm `1-A`; `2 mảnh L` gồm `1-A`, `1-B`; `2 mảnh U+I` gồm `1-A`, `1-B`; `4 mảnh` gồm `1-A`, `1-B`, `1-C`, `1-D`; mảnh bịt đầu rời tiếp nối theo thứ tự (`1-B`, `1-E`, `1-F`...).
  - Hiển thị chữ đánh dấu (`1-A`, `1-B`...) sắc nét ngay trên **mặt đánh dấu (lòng trong)** của từng mảnh tôn trong không gian 3D (chỉ đánh dấu tên mảnh trong lòng, **KHÔNG** chèn chữ ghi chú lên các đường mí hay mép bích).
  - Click trái hoặc chuột phải trực tiếp lên mảnh/đầu nối/mí trên 3D hoặc 2D để tô sáng đồng bộ hai chiều và mở `Floating Inspector` / `Context Menu`.
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
1. **Mí gò Pittsburgh (Mặc định cho tất cả độ dày đến `1.5 mm`):**
   - **Mí kép (Female - màu đỏ):** Tôn thừa phôi `+31 mm`. Dựng mặt cắt 3D rãnh chữ U 2 lớp tôn sát mặt ngoài kèm tai khóa mí đứng thẳng (chưa gò) hoặc ép bẹt 90° (đã gò).
   - **Mí đơn (Male - màu xanh dương):** Tôn thừa phôi `+7 mm`, vát góc 45° cao `7 mm` ở 2 đầu. Dựng gờ bẻ vuông góc 90° quay vào lòng trong.
   - **Hai trạng thái hiển thị:**
     - *Chưa gò mí:* Rãnh mí kép mở, mép gập ngoài đứng thẳng, mí đơn tách nhẹ để quan sát rãnh cắm.
     - *Đã gò mí:* Mí đơn cắm lọt lòng rãnh mí kép, mép ngoài của mí kép bẻ gập 90° khóa chặt lên mí đơn.
2. **Mí hàn (Tùy chọn thay thế tự do cho MỌI đường mí hiện có):**
   - Người dùng có thể tự do chuyển đổi bất kỳ đường mí đơn/mí kép nào (toàn bộ thân ống, từng góc ghép dọc thân qua click/chuột phải trực tiếp lên đường mí, hoặc từng cạnh ghép của **Đầu bịt kín**) sang **Mí hàn** khi không chạy được mí gò.
   - Hỗ trợ 2 kiểu chuẩn hóa: **`Hàn chập`** (nhập độ rộng tự do `7–25 mm`, mặc định `10 mm`) và **`Hàn đấu đầu`** (`0–0`).
   - Nếu `L < 140 mm`: hiển thị gợi ý nhẹ nên chuyển sang Mí hàn (vẫn cho phép người dùng tự chọn).
3. **Nối C (`17 + 17 mm` — ghi nhận từ `REF_NOTES.md` cho chặng mở rộng nối khúc):** Dành cho tấm vượt khổ vật liệu chuẩn (`W_tấm × L_tấm`) hoặc vượt giới hạn máy lăn gân (`rollFormerLimitMm`); phần đầu nối `+17 mm` tại 2 góc có bậc thụt vuông nhỏ nối ra biên chính bằng đoạn vát xéo ~45°.

### 3.3. Quy tắc chia mảnh & Logic Kiểm tra Khổ Tấm Chuẩn Xưởng (Cho phép Xoay phôi 0° hoặc 90°)
- **Kiểm tra vừa khổ tấm (`W_tấm × L_tấm`, mặc định `1200 × 6000` Tôn Mạ Kẽm / `1250 × 6000` Inox):**
  - Gọi 2 kích thước của mỗi mảnh phôi phẳng là **`B_phôi`** (chiều rộng triển khai theo chu vi + mí) và **`L_phôi`** (tổng chiều dài phôi `L + bù C1 + bù C2`).
  - Một mảnh phôi được đánh giá là **`ĐẠT` (trạng thái xanh `ok`, KHÔNG báo vàng/đỏ)** khi thỏa mãn **1 trong 2 hướng cắt trên tấm**:
    1. **Cắt ngang khổ tấm (0°):** `L_phôi ≤ W_tấm` VÀ `B_phôi ≤ L_tấm` → nhãn **`Đạt — Cắt ngang khổ W_tấm`**.
    2. **Xoay dọc tấm (90°):** `B_phôi ≤ W_tấm` VÀ `L_phôi ≤ L_tấm` → nhãn **`Đạt — Xoay dọc tấm W_tấm×L_tấm`** (ví dụ ống `800 × 500, L = 1500`, 4 mảnh, 2 đầu TDC có `B_phôi ≤ 862 mm ≤ 1200` và `L_phôi = 1596 mm ≤ 6000` → **ĐẠT xanh hoàn toàn**, không báo cảnh báo/vượt khổ).
  - Chỉ báo **`VƯỢT KHỔ` (trạng thái đỏ `danger`)** khi **cả hai cạnh đều vượt `W_tấm`** (`min(B_phôi, L_phôi) > W_tấm`) HOẶC **cạnh dài vượt `L_tấm`** (`max(B_phôi, L_phôi) > L_tấm`). Ví dụ ống `500 × 500, L = 1110`, 1 mảnh, 2 đầu TDC có `2038 × 1206 mm` (`min = 1206 > 1200`) → báo đỏ `VƯỢT KHỔ`; cùng kích thước đổi sang 2 đầu Nẹp C có `2038 × 1135 mm` (`1135 ≤ 1200` và `2038 ≤ 6000`) → báo xanh `Đạt — Cắt ngang khổ 1200`.
- **Tự động đề xuất chia mảnh theo khổ tấm xưởng đang cấu hình:**
  - `1 mảnh` (`1-A`): Chu vi `2*(W+H) ≤ 2400 mm` và `L_phôi ≤ W_tấm` (và `B_phôi ≤ L_tấm`).
  - `2 mảnh chữ L` (`1-A`, `1-B`): `2*(W+H) > 2400 mm`, `(W+H) ≤ 3000 mm`, và `L_phôi ≤ W_tấm`. Mặc định cạnh lớn hơn mang **Mí kép**, cạnh nhỏ hơn mang **Mí đơn**.
  - `2 mảnh chữ U+I` (`1-A`, `1-B`): Cho phép chọn thủ công để so sánh.
  - `4 mảnh` (`1-A`, `1-B`, `1-C`, `1-D`): `(W+H) > 3000 mm`, HOẶC khi `L_phôi > W_tấm` mà các mảnh đơn `W + mí ≤ W_tấm` và `H + mí ≤ W_tấm` (xoay dọc tấm `W_tấm × L_tấm`).
- **Tự do tùy biến:** Cho phép chọn thủ công `1 mảnh / 2 mảnh L / 2 mảnh U+I / 4 mảnh`, bấm nút **`Đảo mí kép ↔ mí đơn`** tự do, và đổi kiểu mí `Mí gò ↔ Hàn chập ↔ Hàn đấu đầu`.

### 3.4. Thư viện Đầu kết nối (Chọn độc lập cho Đầu C1 và Đầu C2 — qua thẻ C1/C2 hoặc click/chuột phải trực tiếp trên 3D/2D)

#### A. Nhóm Bích liền thân ống
1. **`TDC/TDF` (Gộp chung làm một lựa chọn duy nhất — đối chiếu thực tế xưởng `REF_NOTES.md`):**
   - Phôi tôn thừa `+48 mm`, khấu góc tổng `60 mm` (khấu sâu thêm `12 mm` vào thân).
   - **Hình học 3D mặt bích & ke góc chuẩn xưởng:**
     - Chiều cao mặt bích 3D hoàn thiện **`32 mm`**, biên dạng gập hộp chữ C kèm **gân giật bậc dọc chính giữa mặt bích** và **mép cuốn J-return sát mặt sau** tạo rãnh kẹp chân ke góc; khe hở tại 4 góc ống khít thực tế (`~2 mm`).
     - **4 ke góc 3D bằng tôn mạ kẽm dập định hình:** 2 chân luồn rãnh bích có **đầu cắt vát chéo ngoài**, gân dập nổi dọc chân và gờ nổi quanh lỗ; **lỗ bulong hình giọt nước có đầu nhọn quay vào phía góc trong lòng ống và cung tròn hướng ra góc ngoài bích** (`ke_góc_đã_đóng_nhìn_mặt_trước.jpg`), trượt rời khi kéo `Tách mảnh`.
   - **Không có vết khấu tam giác ở giữa cạnh dài mặt bích.**
   - Tùy chọn **`Dấu lõm phân biệt đầu (TDF)`** (mặc định TẮT với ống thẳng): khi bật, cắt **1 vết lõm chữ V tam giác nhỏ nằm ngay trên cạnh bên của tai bích `+48 mm`** (đồng bộ giữa 3D và 2D/DXF theo `Bích_TDF_trên_bản_vẽ_với_vết_v_lõm.png` & `bích_TDF_khấu_v_lõm_thực_tế.jpg`).
2. **`Nẹp C` (Bích liền thân ống, KHÔNG vẽ thanh cài rời màu vàng):**
   - Phôi cộng `+12.5 mm`, khấu góc `25 mm`.
   - Phần tôn thừa `+12.5 mm` liền với thân ống được **uốn cong vòng ra ngoài 180° tạo rãnh hình chữ C** có khe hở lòng chữ C rõ nét; cả 4 cạnh Nẹp C **chạy sát ra tận mép góc của từng mặt ống** (chỉ chừa khe hở kỹ thuật rất nhỏ `~1.5–1.8 mm` tại giao điểm 90° của 4 góc để 2 mép không cấn nhau, đồng bộ 3D và 2D theo `nẹp_C.jpg`).
3. **`Đầu bẻ chân` (Tùy biến độc lập từng cạnh):**
   - Chiều rộng bẻ chân `F` nhập tay tự do (mặc định `20 mm`), phôi cộng `+F mm` cho các mảnh có cạnh bẻ (`+0 mm` nếu mảnh chỉ gồm cạnh để thẳng).
   - Cho phép tùy chỉnh độc lập 4 cạnh **`Trên / Dưới / Trái / Phải`** với 3 trạng thái: **`Bẻ vào` | `Bẻ ra` | `Để thẳng`**, kèm 5 nút chọn nhanh (Preset).
   - **Ghép góc thực tế cho `Bẻ vào` (`bẻ_chân_vào_trong_1.jpg`):** Tại góc giao giữa 2 cạnh cùng bẻ vào 90°, **ghép vuông đối đầu gọn (square butt-joint)** — 2 cạnh trên/dưới phủ hết chiều rộng `W`, 2 cạnh đứng trái/phải cắt vuông lùi `F` áp sát vào mặt trong cạnh kề (không cắt hở chéo 45° lớn), đồng bộ trên cả 3D và 2D/DXF.
4. **`Lưới chắn côn trùng (LCCT)`:**
   - Phôi cộng `+20 mm`, chấn vuông góc 90° quay vào lòng trong, kèm nút bật/tắt hiển thị **khung lưới ô vuông có nẹp chia ô** bên trong.
5. **`Đầu bịt kín (End Cap)`:**
   - Mặc định 4 cạnh đầu thân ống chạy **Mí kép chờ (`+31 mm`)** và sinh **Mảnh bịt đầu rời (`1-B` / `1-E` / `1-F`...)** có 4 cạnh **Mí đơn (`+7 mm`, vát 45°)** cùng gân thẳng song song (bước theo `Cài đặt xưởng`, mặc định `210 mm`).
   - Hỗ trợ tự do chuyển đổi toàn bộ hoặc từng cạnh (`Trên / Dưới / Trái / Phải`) sang **`Hàn chập`** (`7–25 mm`) hoặc **`Hàn đấu đầu`** (`0–0`), đồng bộ kích thước phôi mảnh bịt đầu trong tab `S Phôi`.
6. **`Đầu để thẳng` (Đoạn trơn không chạy mí):**
   - Bổ sung ô nhập tay **Chiều dài đoạn để thẳng `L_thẳng`** (`0, 20, 30, 40 mm...`, mặc định `0 mm`; bù phôi `+L_thẳng mm`).
   - **Quy tắc bắt buộc:** Trên suốt chiều dài đoạn để thẳng mở rộng (`L_thẳng > 0`), thân ống **để thẳng trơn hoàn toàn, KHÔNG chạy mí** (đường mí ghép dọc thân dừng lại trước đoạn để thẳng).

#### B. Nhóm Bích rời (KHÔNG vẽ lỗ, ghép vuông góc 2 thanh phủ bì + 2 thanh lọt lòng)
- **Quy tắc ghép góc bắt buộc cho cả Bích V & Bích U:** Không cắt vát chéo 45° trên mặt phẳng khung bích. Khung bích chữ nhật được ghép vuông góc từ **2 thanh có chiều dài phủ bì** và **2 thanh có chiều dài lọt lòng**; góc vát chỉ nằm ở phần thừa đuôi cánh ôm phía sau để không bị cấn góc. **Không vẽ lỗ** trên cả Bích V lẫn Bích U.
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
   - Mặt cắt chữ U lệch cánh: Cánh ôm thân ống (mặc định `30 mm`, đổi tự do) × Mặt bích phẳng (mặc định `40 mm`, đổi tự do) × **Gờ bẻ ngoài cố định `10 mm` quay ngược về phía thân ống** (cùng chiều cánh ôm), ghép 2 thanh phủ bì + 2 thanh lọt lòng và vát tránh cấn ở đuôi cánh ôm.

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
- Hỗ trợ nút **Nhập/Xuất JSON** để nạp nhanh toàn bộ thông số ống.

## 4. Chế độ Trải phẳng phôi 2D & Xuất DXF chuẩn AutoCAD / Bodor Thinker — Kiến trúc Cắm-Rút
- **Kiến trúc độc lập (`FlatPatternDocument` → `FlatPattern2DViewer` + `flatPatternDxfExport`):**
  - Tách riêng kiểu dữ liệu 2D ([flatPattern2d.ts](file:///home/antigravity/EUSTEEL/DUCT3D/src/types/flatPattern2d.ts)), bộ tính biên dạng 2D ([flatPatternBuilder.ts](file:///home/antigravity/EUSTEEL/DUCT3D/src/domain/flatPatternBuilder.ts)), bộ xuất DXF ([flatPatternDxfExport.ts](file:///home/antigravity/EUSTEEL/DUCT3D/src/domain/flatPatternDxfExport.ts)) và trình xem 2D ([FlatPattern2DViewer.tsx](file:///home/antigravity/EUSTEEL/DUCT3D/src/components/FlatPattern2DViewer.tsx)) hoàn toàn độc lập với Three.js.
  - Trình duyệt render vector sắc nét chạy ngầm để zoom/pan mượt trên cả PC lẫn điện thoại; trên giao diện **KHÔNG** hiển thị nút tải SVG hay chữ "SVG".
  - Mọi phụ kiện/chi tiết có trải phẳng sau này chỉ cần sinh mảng `FlatPatternPiece` (kèm tùy chọn lỗ khoét `innerHoles`) để cắm thẳng vào `FlatPattern2DViewer` & bộ xuất DXF; chi tiết nào không cần 2D chỉ cần đặt `flatPatternSupported = false` để vô hiệu hóa nút 2D mà không ảnh hưởng hệ thống.
- **Chuyển chế độ & Tương tác Viewport 2D:**
  - Cụm 3 nút trên thanh công cụ: **`Xem 3D`** | **`Trải phẳng 2D`** | **`Song song 3D + 2D`** (chia đôi màn hình 50/50 để vừa xoay 3D vừa đối chiếu bản cắt Laser 2D).
  - Trình xem 2D hỗ trợ **Zoom bằng con lăn chuột theo tâm trỏ**, **kéo Pan di chuyển**, nút **`Vừa màn hình` (Fit)**, **click trái / chuột phải trực tiếp lên mảnh (`1-A..1-F`), vùng đầu `C1`/`C2` và vùng mí dọc** để mở `Floating Inspector` / `Context Menu` đồng bộ hai chiều 2D ↔ 3D (kèm lệnh **`Phóng to mảnh này`** tự căn zoom vừa mảnh).
- **Biên dạng cắt Laser 1:1 mm (Chuẩn xưởng theo `REF_NOTES.md` — Mặt nhìn: `MẶT ĐÁNH DẤU — Lòng trong ống`):**
  - Tự động vẽ đủ mọi mảnh thân ống (`1-A..1-D`) theo chế độ chia (`1 mảnh O`, `2 mảnh L`, `2 mảnh U+I`, `4 mảnh`) và tự sinh thêm mảnh bịt đầu rời (`1-B`, `1-E`, `1-F`...) nếu C1 hoặc C2 là `Đầu bịt kín`.
  - **`TDC/TDF` (chuẩn bản vẽ & phôi thật `bích_TDC_thực_tế_trên_bản_vẽ.png` / `Bích_TDF_trên_bản_vẽ_với_vết_v_lõm.png` / `phần_khấu_bẻ_giữa_các_mặt,_rộng_2_mm.jpg` — đồng bộ 100% giữa 2D và DXF):**
    - Tổng tôn thừa bích `+48 mm`, khấu sâu vào thân `12 mm` (tổng chiều dài vùng khấu `60 mm`).
    - **Góc khấu biên ngoài tại mép mí dọc:** từ mép ngoài mí dọc (`+31 mm` mí kép / `+7 mm` mí đơn / hàn chập) cắt **bậc vuông góc 90° sắc nét** đi ngang vào trong tới biên thân (tại vị trí lùi `12 mm` vào thân) → chạy thẳng dọc `12 mm` tới ranh giới đầu thân `yBody` → **bậc giật chuyển tiếp siêu nhỏ `~1.5 mm` vào trong** → cạnh bên tai bích `+48 mm` chạy thẳng song song gặp biên ngang ngoài ở góc **90° sắc nét**.
    - **Vết V lõm phân biệt đầu TDF (`showEndIndent = true`):** cắt **1 vết chữ V lõm tam giác nhỏ nằm ngay trên cạnh bên của tai bích `+48 mm`** (cách mép ngoài `~18 mm`, sâu `~3.5 mm`, rộng miệng `~6 mm`).
    - **Khe khấu tại đường chấn 90° giữa các mặt ống** (`1 mảnh O`, `2 mảnh L`, `2 mảnh U+I`): **khe xẻ song song rất hẹp rộng đúng `2 mm`** (`±1 mm` quanh đường chấn), chạy thẳng từ mép ngoài `+48 mm` sâu vào `12 mm` trong thân rồi kết thúc bằng **mũi nhọn V nhỏ** đúng trên tâm đường chấn.
  - **`Nẹp C`:** Bù `+12.5 mm`, khấu góc tổng `25 mm` (`12.5 + 12.5 mm`) với khe hở kỹ thuật góc sát thực tế `~1.5–1.8 mm` (`nẹp_C.jpg`).
  - **`Bích V`:** `V30/V40/V50` ống thường bù `+8 mm` và khấu mí vuông `= V + 5` kèm **bậc lõm nhỏ `~1.5 mm` ngay sát góc nhọn ngoài của mép bẻ `+8 mm`** (`khấu_bẻ_ra_của_bích_V_quay_ngoài,_lõm_ở_góc_nhọn_một_chút.png`); `Bích V EI` bù `+0 mm` khấu góc `= V + 5`; `V80×30` cắt thẳng `+0 mm`; `Bích V quay trong` bù `+0 mm` kèm khấu mí `= V + 5`.
  - **`Bích U`:** Cắt thẳng `+0 mm`.
  - **`LCCT`:** Bù `+20 mm`, vát góc 45° gọn 4 góc để chấn 90° vào lòng trong.
  - **`Bẻ chân`:** Theo từng cạnh độc lập (`Bẻ vào` ghép vuông đối đầu chuẩn xưởng `bẻ_chân_vào_trong_1.jpg`: cạnh trên/dưới phủ đủ `W`, cạnh trái/phải lùi vuông `F` tại góc giao với cạnh bẻ vào kề bên; `Bẻ ra` bù `+F` khấu góc vuông; `Để thẳng` cắt phẳng `+0 mm`).
  - **`Để thẳng` (`+L_thẳng > 0`):** Vẽ đủ chiều dài đoạn kéo dài trơn hoàn toàn, thể hiện rõ **mí ghép dọc thân kết thúc trước đoạn kéo dài** (`0 mm` mí trên đoạn kéo dài).
  - **`Đầu bịt kín`:** Đầu thân ống bù `+31 mm` (mí kép chờ) trên các cạnh chạy mí gò; mảnh bịt rời vẽ `W × H` cộng 4 cạnh **Mí đơn `+7 mm` vát góc 45°** (hoặc tự đổi sang `Hàn chập` / `Hàn đấu đầu` theo cấu hình từng cạnh).
  - **Mí dọc thân:** Mí kép `+31 mm` (nét đứt ranh giới, tô đỏ nhạt ở chế độ Màu kỹ thuật); Mí đơn `+7 mm` vát góc 45° cao `7 mm` ở 2 đầu (tô xanh dương nhạt); `Hàn chập` (`7–25 mm`, tô cam nhạt) & `Hàn đấu đầu` (`0 mm`).
- **Hiển thị kỹ thuật trên trình duyệt & Nút `In / Lưu PDF`:**
  - Vẽ đường chấn 90° nét đứt xanh lá, **gân thẳng chạy song song 2 đầu bích C1 & C2** theo bước cấu hình xưởng (mặc định `210 mm`), nhãn tâm mảnh (`1-A`, `1-B`, `1-E`...) kèm `Mặt nhìn: MẶT ĐÁNH DẤU (Lòng trong ống)`, đường kích thước tổng & chi tiết.
  - **Đường giới hạn khổ vật liệu & máy lăn gân trên bản 2D:**
    - Đường khổ vật liệu tự động căn đúng theo hướng cắt hợp lệ: đường ngang `Khổ W_tấm` khi cắt ngang (0°), hoặc đường đứng màu xanh lá `Khổ W_tấm (Xoay dọc)` khi xoay dọc hợp lệ (90°), và chỉ báo đỏ khi thực sự vượt khổ cả 2 hướng.
    - Đường giới hạn máy lăn gân (`rollFormerLimitMm`, mặc định `1900 mm`) **CHỈ đặt theo phương ngang kiểm tra `L_phôi` (vuông góc đường gân)** — tuyệt đối không so với chiều rộng chu vi `B_phôi`.
  - Nút **`In / Lưu PDF`** chỉ sinh bản in nền trắng tại thời điểm người dùng bấm nút (đầy đủ kích thước, đường chấn, gân theo bước xưởng và nhãn `1-A, 1-B...` để in kẹp lệnh sản xuất hoặc gửi Zalo; không hiển thị `kg`).
- **Quy chuẩn xuất **`Tải file DXF`** (chuẩn AutoCAD & Bodor Thinker 3.0):**
  - Định dạng ASCII DXF `AC1015` đầy đủ `HEADER` (`$INSUNITS = 4` đơn vị mm, `$MEASUREMENT = 1`), `TABLES` (`LAYER`, `STYLE`, `DIMSTYLE` `STANDARD`), `BLOCKS`, `ENTITIES`, `OBJECTS`.
  - Tỷ lệ tuyệt đối **`1:1` (mm)**, **đã lật trục tọa độ Y hướng lên trên** chuẩn CAD; các mảnh tự động xếp thoáng cách đều **`20 mm`** không chồng đè.
  - **Chỉ chứa duy nhất 2 Layer:**
    1. **Layer `CUT`:** Duy nhất biên dạng cắt ngoài (và lỗ khoét bên trong ở các chặng sau) bằng đường đa tuyến khép kín **`LWPOLYLINE`** (`70 = 1`, không hở góc, không trùng nét).
    2. **Layer `DIM`:** Các đường kích thước tổng & cạnh chính xuất **bắt buộc bằng đối tượng `DIMENSION` chuẩn gốc DXF** (`0 / DIMENSION`, linear `70 = 32`, `DIMSTYLE STANDARD`), tuyệt đối không dùng `LINE` hay `TEXT` rời.
  - **Loại bỏ 100% khỏi file DXF:** đường chấn nét đứt, đường gân tăng cứng, đường/khung giới hạn khổ tôn, mọi chú thích diễn giải và toàn bộ nhãn chữ lòng trong (`1-A`, `1-B`...).

## 5. Chế độ Mở phôi 3D (`Mở phôi 3D: 0% → 100%`) — Kiến trúc Bản lề Phân cấp 60fps
- **Vị trí & Cắm-rút:** Thanh trượt **`Mở phôi 3D`** (`0%` Gập thành phẩm → `100%` Mở phẳng phôi 3D) đặt cạnh `Tách mảnh` trên thanh công cụ phía trên Viewport; hỗ trợ cờ cắm-rút `unfoldSupported` (BẬT với ống thẳng & phụ kiện vuông chấn phẳng, TẮT/ẩn với phụ kiện lốc tròn).
- **Hiệu năng 60fps không tái tạo geometry:** Dựng sẵn cây bản lề phân cấp ([unfoldRigBuilder.ts](file:///home/antigravity/EUSTEEL/DUCT3D/src/domain/unfoldRigBuilder.ts) → [DuctAssembly.tsx](file:///home/antigravity/EUSTEEL/DUCT3D/src/three/DuctAssembly.tsx)) với các pivot `Group` đặt chính xác tại từng trục đường chấn và đường gập. Khi kéo `Mở phôi 3D` hoặc `Tách mảnh`, chỉ cập nhật `rotation`, `position` và độ mờ vật liệu chi tiết rời — **không** tạo lại `BufferGeometry`.
- **Trình tự chuyển động gập/mở chân thực:**
  1. **`0% → 30%`:** Toàn bộ chi tiết rời không liền tôn (`4 ke góc TDC`, `Bích V rời`, `Bích U rời`, `Khung lưới LCCT`, `Mảnh bịt đầu rời`) tự trượt tách dọc trục ra xa và giảm độ mờ nhẹ (`1.0 → 0.28`) để tránh đâm xuyên khi các mặt tôn mở ra.
  2. **`0% → 100%`:**
     - Các mặt thân ống trên cùng một mảnh (`1 mảnh O`: 3 bản lề; `2 mảnh L`: 1 bản lề/mảnh; `2 mảnh U+I`: 2 bản lề ở mảnh U) xoay mở phẳng dần `90° → 0°` quanh đúng các đường chấn về mặt phẳng ngang (lòng trong `MẶT ĐÁNH DẤU` hướng lên trên); với `4 mảnh`, 4 tấm tách nhẹ ra hàng phẳng quan sát trọn bộ.
     - Toàn bộ nếp bẻ liền tôn (**`Mí đơn +7 mm`**, **chuỗi nếp gập `Mí kép +31 mm`**, **`Hàn chập`**, **`Bẻ chân` từng cạnh**, **`LCCT +20 mm`**, **mép lật `+8 mm` Bích V thường**, **chuỗi gập `TDC/TDF +48 mm` kèm gân mặt bích & mép cuốn J**, **nếp uốn 180° `Nẹp C +12.5 mm`**, và **mí chờ đầu bịt kín**) xoay mở phẳng dần về `0°` thành tấm phôi phẳng 3D.
  3. Phối hợp hoàn hảo với **`Tô màu kỹ thuật`** (thấy rõ Đỏ = Mí kép, Xanh dương = Mí đơn, Vàng = Bích, Xanh lá = Đường chấn trải phẳng ngay trong không gian 3D) và hoạt động độc lập, không xung đột với `Tách mảnh`.