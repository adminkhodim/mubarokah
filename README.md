# Mubarokah App — Sanitized Application Base

Sanitized repository foundation for Mubarokah App, establishing an independent decoupled frontend and backend engine architecture.

## Current status

- Frontend: Vanilla HTML/CSS/JavaScript SPA shell.
- Backend engine: Google Apps Script bridge (`legacy/Code.gs`).
- API contract test: `tests/api-contract-test.html`.
- Google Sheets / Drive integration: Pending tenant configuration.
- Vercel API layer: Pending tenant configuration.

## Architecture direction

```text
Browser
  |
  v
Index.html
  |
  v
API Adapter
  |
  +---- current bridge ----> Google Apps Script Web App
  |
  +---- target ------------> Vercel API
                              |
                              v
                        Repository Layer
                              |
                              v
                        Google Sheets / Drive
```

## API actions currently supported by Apps Script bridge

### GET

- `action=getKabar`
- `action=getBanner`
- `action=checkStatus&nisn={nisn}`

### POST

- `action=submitPPDB`
- `action=saveBerita`
- `action=saveBanner`
- `action=deleteBanner`
- `action=toggleBanner`

## Important

Do not commit secrets, service-account credentials, private keys, or production `.env` files.

Admin API authorization is not yet production-ready in the Apps Script bridge. Do not expose admin mutations as a trusted production security boundary until the Vercel/server-side auth layer is implemented.
