# SPEC MODULE 1: WEB APP 3D ỐNG GIÓ (EUSTEEL)

## 1. Mục tiêu & Kiến trúc tổng thể
- **Mục tiêu:** Web App 3D tham số hóa phục vụ đào tạo nhân sự kỹ thuật & sản xuất đọc hiểu cấu tạo thật của ống gió (mí ghép, bích kết nối, đường chấn, vết khấu, chia mảnh theo khổ tôn 1200mm, trổ lỗ gắn chân rẽ/cổ tròn/tyren).
- **Công nghệ:** React + Vite + TypeScript + Tailwind CSS + Three.js (`@react-three/fiber`, `@react-three/drei`). Chạy 100% phía trình duyệt (client-side), không cần backend, có thể build tĩnh đẩy lên GitHub Pages.
- **Ngôn ngữ giao diện:** 100% Tiếng Việt chuyên ngành cơ khí ống gió.
- **Bố cục màn hình:**
  - **Cột trái (340px, hỗ trợ nút ẩn/hiện để xem 3D toàn màn hình 100%):** 3 Tab:
    1. `Thông số` (kích thước W/H/L kèm chọn bước nhảy `10 / 50 / 100 mm` hoặc nhập tay, chọn vật liệu `Tôn Mạ Kẽm / Inox`, độ dày, chia mảnh theo khổ vật liệu chuẩn, chọn loại mí & đảo mí, đầu kết nối C1/C2, phụ kiện trổ lỗ, tiêu âm).
    2. `Nhập LSX` (dán text LSX, dán JSON, ghim ảnh bản vẽ tham chiếu `Ctrl+V`).
    3. `S Phôi` (tổng diện tích phôi `m²`, khổ vật liệu chuẩn `1200 / 1250 mm`, bảng kích thước & diện tích `m²` từng mảnh, cảnh báo lọt khổ — **không hiển thị khối lượng kg**).
  - **Vùng chính giữa (3D/2D Viewport):** Chuyển đổi giữa **Xem 3D Thành phẩm**, **Tách mảnh 3D (Exploded View)** và **Trải phẳng phôi 2D (SVG có kích thước, đường chấn, vết khấu V, ký hiệu mặt đánh dấu)**. Khi thu gọn cột trái, viewport tự động mở rộng 100% kèm nút nổi góc trên-trái để mở lại bảng điều khiển.
  - **Thanh công cụ nhanh phía trên Viewport:**
    - Chế độ vật liệu: `Tôn Mạ Kẽm` / `Inox` (tự động đồng bộ theo vật liệu đang chọn) ↔ `Tô màu kỹ thuật (Đỏ = Mí kép, Xanh dương = Mí đơn, Vàng = Bích, Xanh lá = Đường chấn)`.
    - Thanh trượt `Tách mảnh (0% → 100%)`.
    - Công tắc trạng thái mí: `Chưa gò mí (vừa chạy máy)` ↔ `Đã gò mí hoàn thiện`.
    - Công tắc bật/tắt `Gân tăng cứng` (1 dạng gân thẳng duy nhất).
    - Nút `Đảo mí kép ↔ mí đơn` tự do.

## 2. Yêu cầu Đồ họa 3D, Vật liệu & Môi trường hiển thị
- **Vật liệu 3D theo chủng loại vật liệu:**
  - **`Tôn Mạ Kẽm` (hoa tôn nhỏ — khổ chuẩn `1200 mm`):** Tạo texture thủ tục (procedural canvas `map` + `roughnessMap` + `bumpMap` nhẹ) mô phỏng đúng **tôn mạ kẽm hoa nhỏ (mini-spangle)**: tông bạc xám lạnh tự nhiên, các hạt tinh thể hoa kẽm kích thước nhỏ và mịn, độ phản chiếu kim loại sắc nét (`metalness: 0.80–0.85`, độ nhám biến thiên tinh tế giữa các hạt tinh thể).
  - **`Inox` (khổ chuẩn `1250 mm`):** Bề mặt Inox xước mịn sáng bóng (**brushed stainless steel**, tuyệt đối không có hoa kẽm), các đường xước hairline mảnh đều chạy dọc tấm, độ phản chiếu kim loại sáng mượt (`metalness: 0.90–0.94`, roughness thấp mịn).
- **Môi trường 3D tương phản nổi bật chi tiết:**
  - Nền viewport 3D dùng **studio tối dịu tương phản cao** (gradient xám xanh đậm `#1c2432` → `#0f141d`) kèm sàn lưới kỹ thuật mờ nhẹ.
  - Hệ ánh sáng studio 3 điểm + HDRI softbox phản chiếu (Environment lightformers sáng trắng/xanh nhạt đặt góc nghiêng) + đèn rim-light bắt sáng các cạnh bẻ, kết hợp đường viền cạnh rất mảnh (`Edges` độ đậm thấp) giúp mọi nếp gấp mí, rãnh bích, khe hở góc và gân thẳng nổi khối rõ ràng, không bị lóa trắng hay chìm vào nền.
- **Hiển thị 3D sạch sẽ, đúng hình học:**
  - Trong lòng trong ống và tại các phần mí bẻ **KHÔNG chèn chữ hay nhãn ghi chú 3D**, chỉ tập trung thể hiện chính xác hình dạng hình học thật của từng nếp gấp.
- **Gân tăng cứng:**
  - Chỉ sử dụng **1 dạng gân thẳng** duy nhất (các đường gân nổi thẳng song song chạy vuông góc với chiều dài `L` của ống, bước gân đều ~250–300mm), tuyệt đối không vẽ gân chéo chữ X.

## 3. Thông số hình học & Quy chuẩn nhà máy (Ống thẳng)
### 3.1. Kích thước cơ bản & Chủng loại vật liệu
- `W` (Width - Rộng, mm), `H` (Depth - Cao, mm), `L` (Length - Dài, mm): hỗ trợ nhập tay mượt mà từ bàn phím và nút `-`/`+` theo **Bước nhảy** tùy chọn (`10` | `50` | `100 mm`, mặc định `50 mm`, hoặc gõ số tùy ý).
- **Vật liệu & Độ dày chuẩn (`t`):**
  - **Tôn Mạ Kẽm:** Độ dày `0.58, 0.75, 0.95, 1.15, 1.2, 1.5 mm`; khổ vật liệu chuẩn **`1200 mm`** (tấm tiêu chuẩn `6000 × 1200 mm`).
  - **Inox:** Độ dày `0.6, 0.8, 1.0 mm` (tự động chọn `0.8 mm` khi chuyển từ độ dày không thuộc danh sách Inox); khổ vật liệu chuẩn **`1250 mm`** (tấm tiêu chuẩn `6000 × 1250 mm`).
- **Quy ước chiều bẻ theo mặt tôn:**
  - `Mặt đánh dấu` là **mặt trong lòng ống** (chỉ ghi ký hiệu trên bản vẽ trải phẳng 2D, không cần in chữ rườm rà trong lòng 3D).
  - Mí đơn, LCCT, đường chấn góc thân ống đều bẻ vuông góc 90° **vào phía lòng trong (mặt đánh dấu)**.
  - Bích TDF/TDC quay ngoài bẻ vuông góc **ra ngoài (ngược chiều mặt đánh dấu)**; rãnh Mí kép Pittsburgh nằm bên **mặt ngoài (mặt không đánh dấu)**.

### 3.2. Thư viện Mí ghép dọc thân (Seams)
1. **Mí gò Pittsburgh (Mặc định cho tất cả độ dày đến `1.5 mm`):**
   - **Mí kép (Female - màu đỏ):** Tôn thừa phôi `+31 mm`. Dựng mặt cắt 3D rãnh chữ U kẹp thật nằm bên mặt ngoài.
   - **Mí đơn (Male - màu xanh dương):** Tôn thừa phôi `+7 mm`, vát góc 45° cao `7 mm` ở 2 đầu. Dựng gờ bẻ vuông góc 90° quay vào lòng trong.
   - **Hai trạng thái hiển thị:**
     - *Chưa gò mí:* Rãnh mí kép mở, mép gập ngoài đứng thẳng, mí đơn tách nhẹ để quan sát rãnh cắm.
     - *Đã gò mí:* Mí đơn cắm lọt lòng rãnh mí kép, mép ngoài của mí kép bẻ gập 90° khóa chặt lên mí đơn.
2. **Mí hàn (Tùy chọn thay thế linh hoạt cho các đường mí hiện có):**
   - Người dùng có thể tự do chọn chuyển đổi từ **Mí gò** sang **Mí hàn** cho toàn bộ ống hoặc từng đường ghép (chuẩn bị sẵn dùng chung cho các phụ kiện bắt buộc hàn ở các module sau).
   - Hỗ trợ 2 kiểu: **Mí hàn chồng** (nhập độ rộng tự do `7–25 mm`, mặc định `10 mm`) và **Hàn đấu đầu (`0–0`)**.
   - Nếu `L < 140 mm`: hiển thị gợi ý nhẹ nên chuyển sang Mí hàn (vẫn cho phép người dùng tự chọn).
3. **Nối C (`17 + 17 mm`):** Dành cho tấm vượt khổ vật liệu chuẩn (`1200 mm` với Tôn Mạ Kẽm / `1250 mm` với Inox) hoặc vượt chiều dài máy lăn gân (`1900 mm`).

### 3.3. Quy tắc chia mảnh & Đảo mí tự do
- **Tự động đề xuất theo khổ vật liệu chuẩn `B_sheet` (`1200 mm` Tôn Mạ Kẽm / `1250 mm` Inox) và chu vi:**
  - `1 mảnh` (gấp chữ O - 1 mối ghép mí): Chu vi `2*(W+H) ≤ 2400 mm` và chiều dài phôi `L_blank ≤ B_sheet`.
  - `2 mảnh chữ L` (2 mối ghép mí): `2*(W+H) > 2400 mm`, `(W+H) ≤ 3000 mm`, và `L_blank ≤ B_sheet`. Mặc định: mỗi mảnh gồm 1 cạnh `W` + 1 cạnh `H`, cạnh lớn hơn mang **Mí kép**, cạnh nhỏ hơn mang **Mí đơn**.
  - `2 mảnh chữ U+I`: Cho phép người dùng chọn thủ công để so sánh.
  - `4 mảnh` (4 mối ghép mí): `(W+H) > 3000 mm`, HOẶC khi `L_blank > B_sheet` mà cả `W` và `H` (sau cộng mí) đều `≤ B_sheet` (xoay dọc tấm `6000 × B_sheet`). Mặc định: **2 tấm cạnh dài hơn mang 2 Mí kép**, **2 tấm cạnh ngắn hơn mang 2 Mí đơn**.
- **Tự do tùy biến:** Cho phép chọn thủ công `1 mảnh / 2 mảnh L / 2 mảnh U+I / 4 mảnh`, bấm nút **`Đảo mí kép ↔ mí đơn`** tự do, và đổi kiểu mí `Mí gò ↔ Mí hàn`.

### 3.4. Thư viện Đầu kết nối (Chọn độc lập cho Đầu C1 và Đầu C2)
1. **Bích TDC / TDF (Quay ngoài):**
   - Phôi tôn thừa `+48 mm`, khấu góc tổng `60 mm` (khấu sâu thêm `12 mm`).
   - Chiều cao mặt bích 3D hoàn thiện: **32 mm**, dựng rõ biên dạng gập rỗng hình hộp chữ C của bích TDC + **4 ke góc 3D có lỗ bắt bulong hình giọt nước** luồn trong rãnh (khi tách mảnh, ke góc trượt rời ra ngoài).
   - **Phân biệt TDC vs TDF:** Đầu `TDC` có **2 vết khấu chữ V nhỏ** trên cạnh ngang của mặt bích; đầu `TDF` không có vết khấu.
2. **Bích TDC / TDF quay vào trong:**
   - Phôi cộng `+48 mm`, khấu sâu `42 mm`, rộng `32 mm`, mặt bích gập quay vào lòng trong.
3. **Nẹp C (`NC` / `NC#`):**
   - Phôi cộng `+12.5 mm`, khấu `25 mm`.
   - Dựng 3D mép tôn gập 180° ôm sát mặt ngoài thân ống dài `12.5 mm`, để khe hở thoáng ở 4 góc. Có nút bật/tắt **thanh Nẹp cài C rời** (bản `46 mm`) trượt ngoài.
   - **Phân biệt NC vs NC#:** `NC#` có vết khấu chữ V nhỏ trên cạnh ngang mặt bích.
4. **Bích V rời (Hàn ngoài / Hàn trong — KHÔNG vẽ lỗ, chỉ thể hiện hình khối khung bích):**
   - Quy cách chọn sẵn: `V30×30`, `V40×40`, `V50×50`, `V80×30`; độ dày `2 / 3 / 4 mm`; 4 góc cắt vát 45° hàn kín.
   - **Phôi tôn thân ống:**
     - `V30/V40/V50` ống thường: phôi cộng **`+8 mm`** để chạy mí bẻ lật ra ôm mép bích, khấu góc `= V + 5`.
     - `V80×30` và `Bích V EI`: phôi cắt thẳng **`+0 mm`** (EI khấu góc `= V + 5`).
   - **Quy cách kích thước khung bích:**
     - *Quay trong (thường & EI):* Phủ bì khung V = `W-3 × H-3`.
     - *Quay ngoài ống thường:* Lòng trong khung V = `W+5 × H+5`.
     - *Quay ngoài EI (30/45/60/120):* Lòng trong khung V = `W-3 × H-3`.
5. **Bích U rời (KHÔNG vẽ lỗ, chỉ thể hiện hình khối khung bích):**
   - Độ dày `1.5 / 2 / 3 mm`, phôi thân ống cắt thẳng **`+0 mm`**.
   - Mặt cắt chữ U lệch cánh: Cánh ôm thân ống (mặc định `30 mm`, đổi tự do) × Mặt bích phẳng (mặc định `40 mm`, đổi tự do) × **Gờ bẻ ngoài cố định `10 mm` quay về phía thân ống** (cùng chiều cánh ôm).
6. **Đầu để trơn (để thẳng):** Cắt phẳng `+0 mm`, không bích.
7. **Đầu bẻ chân (vào trong / ra ngoài):**
   - Chiều rộng bẻ chân `F` nhập tự do theo LSX (mặc định `20 mm`), phôi cộng `+F mm`.
   - 4 cạnh chấn vuông góc 90° quay vào trong hoặc ra ngoài, 4 góc cắt gọn chồng mép.
8. **Đầu gắn Lưới chắn côn trùng (`LCCT`):**
   - Phôi cộng `+20 mm`, chấn vuông góc 90° quay vào lòng trong, kèm nút bật/tắt hiển thị **khung lưới ô vuông có nẹp chia ô** bên trong.
9. **Đầu bịt kín (End Cap):**
   - Đầu thân ống chạy sẵn **rãnh Mí kép chờ cả 4 cạnh** (`+31 mm`).
   - Sinh thêm **Mảnh bịt đầu rời** có **4 cạnh chạy Mí đơn (`+7 mm`, vát góc 45°)** và gân thẳng; khi kéo thanh tách mảnh, mảnh bịt tách tịnh tiến ra khỏi đầu ống để thấy rõ cách lồng mí đơn vào mí kép.

### 3.5. Phụ kiện gắn kèm, Lỗ trổ & Chi tiết gia công trên thân ống
- **Tyren tăng cứng (`M8 / M10`):** Nhập số lượng và vị trí khoảng cách từ đầu C1 (hoặc chia đều tự động). Dựng thanh ren xuyên ống kèm lỗ khoan trên 2 mặt đối diện và ecu/long đen.
- **Lỗ trổ & Phụ kiện gắn lên 4 mặt (`Trên / Dưới / Hông trái / Hông phải`):**
  - *Chân rẽ vuông / Chân rẽ vát (Shoe):* Nhập kích thước đáy `W1×H1`, đầu ra `W2×H2`, chiều dài `L_branch`, chiều rộng bẻ chân (ví dụ `20 mm`), bích đầu ra (`TDC / Nẹp C / Trơn`), hướng vát (`Về C1 / Về C2 / Cân tâm`), khoảng cách từ đầu C1.
  - *Chân rẽ vuông tròn / Cổ tròn:* Tự động áp quy chuẩn nhà máy **giảm `5 mm` đường kính cổ** (ví dụ `D200 → D195`, có công tắc tắt nếu LSX ghi "làm đúng D"), dựng gân tròn trên cổ và tai bẻ chân.
  - *Cửa thăm / Lỗ trổ trống:* Khoét lỗ vuông/tròn/oval đúng vị trí trên mặt tôn (cả trên 3D và phôi trải phẳng 2D).
- **Ống tiêu âm (tùy chọn bật/tắt):** Bông khoáng dày `25 / 50 / 100 mm` + lớp tôn soi lỗ (`H23 bẻ 15`, `H45 bẻ 20`, `H95 bẻ 20`), hỗ trợ chế độ cắt mặt cắt để soi lớp tiêu âm bên trong.

### 3.6. Chế độ nhập LSX & Tham chiếu bản vẽ
- **Parser Tiếng Việt:** Nhận diện một số mẫu như:
  - `Ống gió KT: 500x320, L1110, bích TDC`
  - `Ống gió KT: 1200x600, L50, 1 đầu bích TDC, 1 đầu để thẳng`
  - `Ống gió KT 900x700, L1540, 2 đầu bích TDC, tăng cứng 2 tyren M10, hông trái 700x1540 gắn 1 chân rẽ KT 1000x600(bẻ chân 20mm)/850x600(bích TDC), L150, hông phải 700x1540 gắn 1 chân rẽ KT 750x400(bẻ chân 20mm)/600x400(bích TDC), L150, xem hình vẽ`
- **Hỗ trợ "xem hình vẽ":** Cho phép dán (`Ctrl+V`) hoặc tải ảnh bản vẽ vào khung cửa sổ nổi thu gọn/phóng to để đối chiếu, chỉnh trực tiếp khoảng cách offset của từng chân rẽ/tyren, và nút **Nhập/Xuất JSON** để nạp nhanh toàn bộ tọa độ.