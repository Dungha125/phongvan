# Interview Check-in

Hệ thống check-in phỏng vấn với 2 bàn, gán bàn lần lượt khi check-in.

## Chạy local

```bash
cd interview-checkin
npm run dev
```

- Check-in: http://localhost:5173/
- Bàn 1: http://localhost:5173/view/1
- Bàn 2: http://localhost:5173/view/2

## Production

### Backend (đã deploy Docker trên VPS)

- API: https://api.pv.lcdkhoacntt1.com
- Health: https://api.pv.lcdkhoacntt1.com/health
- Container: `interview-checkin-api`
- Bind: `127.0.0.1:8011` → Caddy reverse proxy
- Code trên server: `/opt/interview-checkin`

```bash
cd /opt/interview-checkin
docker compose up -d --build
```

### Frontend (Vercel)

Deploy thư mục `client/`. Đã có:

- `client/vercel.json` — SPA rewrite tránh 404 khi reload
- `client/.env.production` — `VITE_API_BASE=https://api.pv.lcdkhoacntt1.com`

URL (không có tab nav — cấp theo path):

- Login check-in: `/login`
- Check-in (cần đăng nhập): `/`
- Bàn 1: `/view/1`
- Bàn 2: `/view/2`

Tài khoản check-in (chỉ account này được check-in / hủy / reset):

- User: `checkin`
- Pass: `CtvCheckin@2026`

Khi bàn gọi người tiếp theo, trang check-in hiện popup thông báo để mời thí sinh vào.

Domain FE: `https://pv.lcdkhoacntt1.com`

Danh sách thí sinh lấy từ `server/roster.csv` (45 người). Check-in chỉ với người trong CSV. Reset đưa về CSV gốc.

## Luồng

1. Check-in → số thứ tự, gán Bàn 1 / Bàn 2 xen kẽ
2. `/view/1` và `/view/2` gọi độc lập
3. **Người tiếp theo** → popup xác nhận
4. **Hoàn thành** giải phóng bàn

## Chống xung đột

- Hàng chờ tách theo `tableNumber`
- Mutex tuần tự trên server
- HTTP 409 nếu bàn đang bận
