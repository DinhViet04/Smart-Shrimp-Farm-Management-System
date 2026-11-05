# Database deployment

The migration history is baselined for a new PostgreSQL database. Do not run
`prisma db push` in production.

## Deploy and seed

Set `DATABASE_URL` and `DIRECT_URL` to the production PostgreSQL connection.
For the first deployment, also set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`
(at least 12 characters), and optionally `SEED_ADMIN_NAME`.

```powershell
npm run db:migrate:deploy
npm run db:seed
```

The seed is idempotent. On an existing account it restores the admin role and
active status but does not overwrite the current password.

## Backup and restore

Create a custom-format backup:

```powershell
pg_dump --format=custom --no-owner --no-acl --dbname "$env:DATABASE_URL" --file ssfm.dump
```

Restore into an empty database and stop on the first SQL error:

```powershell
pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl --dbname "$env:RESTORE_DATABASE_URL" ssfm.dump
```

Always restore into a separate database first and verify the migration table
and row counts before using a backup for disaster recovery.
