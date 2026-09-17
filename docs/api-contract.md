# API Contract — Mubarokah App

## Target public API

```text
GET  /api/news
GET  /api/banner
GET  /api/ppdb/status?nisn={nisn}
POST /api/ppdb
```

## Target admin API

```text
GET    /api/admin/ppdb

POST   /api/admin/news
PUT    /api/admin/news/:id
DELETE /api/admin/news/:id

POST   /api/admin/banner
PUT    /api/admin/banner/:id
DELETE /api/admin/banner/:id
PATCH  /api/admin/banner/:id/status

POST   /api/auth/login
POST   /api/auth/logout
```

## Response convention

Success:

```json
{
  "status": "success",
  "data": {}
}
```

Error:

```json
{
  "status": "error",
  "message": "..."
}
```

## Current Apps Script bridge mapping

| Action | Apps Script function |
|---|---|
| `getKabar` | `getKabarData()` |
| `getBanner` | `getBannerData()` |
| `checkStatus` | `checkStatusPendaftar()` |
| `submitPPDB` | `submitPendaftaran()` |
| `getPPDB` | `getPendaftarData()` |
| `saveBerita` | `simpanBerita()` |
| `saveBanner` | `simpanBanner()` |
| `deleteBanner` | `hapusBanner()` |
| `toggleBanner` | `toggleStatusBanner()` |
