# Taichung HOC

## Storage (Cloudflare R2)
- Game images upload to Cloudflare R2 via the S3 API (`lib/server/storage.ts`).
- Required env vars (`.env.local` and production):
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_ENDPOINT` (required; your R2 S3 endpoint or custom domain)
- Buckets should permit signed URL reads (we generate 7-day GET URLs).

## Development
- Install deps: `pnpm install`
- Run dev server: `pnpm dev`
- Open http://localhost:3000
