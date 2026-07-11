# PMS private document storage deployment

## Security boundary

Public marketplace images continue to use `UPLOAD_DIR` and `/uploads`. PMS and tenant documents use `PMS_PRIVATE_DOCUMENT_DIR` and must never be exposed by Express static middleware, a reverse-proxy alias, a public object-store ACL, or CDN caching.

Required local deployment settings:

```env
UPLOAD_DIR=/srv/lux-om/public-uploads
PMS_PRIVATE_DOCUMENT_DIR=/srv/lux-om/private-pms-documents
MAX_PMS_DOCUMENT_MB=10
```

Use different absolute directories and different backup access policies. The backend creates private subdirectories with restrictive permissions and files with mode `0600`; deployment ownership must allow only the application account and approved backup agent.

## Stored metadata

Each private document records:

- storage driver and opaque storage key
- original filename
- MIME type and byte size
- SHA-256 checksum
- uploader/updater
- upload and replacement timestamps
- file version
- scanner/quarantine status

Only PDF, JPEG, PNG, and WEBP are currently approved. Validation checks extension, MIME declaration, configured size limit, and file signature. This is not malware scanning.

## Download behavior

PMS operators download through `/api/pms/documents/:documentId/download`. Tenant users use `/api/tenant/documents/:documentId/download` and must own the linked tenant access. Both routes reapply company, property, document, and sensitive-data permissions before reading storage. Responses are attachments with `no-store`, `private`, and `nosniff` headers. Upload, download, and replacement actions are audited.

## Legacy migration

1. Back up PostgreSQL, `UPLOAD_DIR`, and the private directory.
2. Deploy the schema migration and generate Prisma Client.
3. Run `npm run ops:pms-documents:migrate -- --limit=500`.
4. Resolve external/manual URLs by securely retrieving and re-uploading the source document.
5. Run `npm run ops:pms-documents:migrate -- --execute --limit=500` for local `/uploads` records.
6. Confirm the old public file is removed and its URL returns `404`.
7. Verify checksum, authenticated PMS download, tenant denial/cross-company denial, and audit records.
8. Repeat in bounded batches.

The migration moves approved local files across the security boundary and removes the public source. A failed database update removes the new private copy where possible and leaves the record for operator remediation.

## Object storage and scanning

`OBJECT_STORAGE` and scan statuses are foundations only. A future adapter must provide private bucket policy, server-side encryption, short-lived signed URLs or authenticated streaming, checksum validation, object versioning, deletion/retention controls, and auditable access. Do not set scan status to `CLEAN` without a real scanner result tied to the exact checksum and file version.

## Backup and restore

Database and private-file backups form one consistency set. Snapshot them in the same maintenance window, encrypt both at rest and in transit, and retain a manifest with document ID, storage key, checksum, and backup timestamp. Quarterly restore tests should verify that an authorized download succeeds and an unauthorized request remains denied. Never restore private files into `UPLOAD_DIR`.
