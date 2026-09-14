# Cloudflare R2 setup

Resaller uses two private R2 buckets. Neither bucket needs public access because
the API authorizes and streams every object.

1. Create `resaller-media` for listing images and thumbnails.
2. Create `resaller-private-media` for verification documents, order chat
   attachments and dispute evidence.
3. Create one R2 S3 API token scoped to Object Read & Write for only these two
   buckets. Do not create an account-wide token.
4. Store the values in the staging/production secret manager, never in Git:

```dotenv
MEDIA_STORAGE_DRIVER=s3
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=resaller-media
S3_PRIVATE_BUCKET=resaller-private-media
S3_ACCESS_KEY_ID=<secret-manager-value>
S3_SECRET_ACCESS_KEY=<secret-manager-value>
S3_FORCE_PATH_STYLE=false
```

The public-media bucket is still private at R2 level. `/api/v1/media/:key`
serves only media belonging to active products and active stores. Private media
is returned only after the API checks the signed-in user or operator role and
records the sensitive read in the audit log.

After credentials are installed, verify a listing image upload/download and a
verification-document upload/download on staging. Then confirm both objects are
present in their expected buckets and that anonymous R2 URLs cannot read them.
