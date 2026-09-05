# Interview Check-in

Hệ thống check-in phỏng vấn với 2 bàn, gán bàn lần lượt khi check-in.

## Chạy

```bash
cd interview-checkin
npm run dev
```

- Check-in: http://localhost:5173/
- Màn hình gọi số: http://localhost:5173/view
- API: http://localhost:3001

## Luồng

1. Check-in → nhận số thứ tự, tự gán Bàn 1 / Bàn 2 xen kẽ
2. `/view/1` và `/view/2` — mỗi bàn gọi độc lập (hàng chờ tách theo bàn)
3. Bấm **Người tiếp theo** → popup xác nhận → gọi người đầu hàng của đúng bàn đó
4. Bấm **Hoàn thành** để giải phóng bàn

## Chống xung đột khi gọi cùng lúc

- Bàn 1 và bàn 2 chỉ lấy người `waiting` đúng `tableNumber` → không tranh cùng 1 người
- Mọi thao tác ghi (check-in / next / complete) đi qua **mutex tuần tự** trên server
- Ghi file qua temp + rename; nếu bàn đang bận hoặc người đã bị lấy → HTTP 409
