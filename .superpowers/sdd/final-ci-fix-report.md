# Phase 1 CI Fix Report

## Fix summary

- Build artifacts are now packed as `next-build.tar.gz` before upload, so the hidden `.next` directory is preserved by `actions/upload-artifact@v4`.
- Production build steps in both workflows now receive `NODE_ENV`, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_APK_CENTER_ADMIN_URL` directly.
- Release builds fail before compilation when repository variable `NEXT_PUBLIC_APP_URL` is unset.
- Branch and pull-request builds intentionally permit missing public repository variables so application defaults can be used where available.
- The VPS apply script resolves the Prisma CLI version from `package-lock.json` and executes that version through `npx --yes` without modifying installed dependencies.
- Optional `PM2_APP` and `SYSTEMD_UNIT` hooks stop the application before unpacking and start it after Prisma generation/migration.
- Existing `.next` output is retained as `.next.prev`; the script prints the exact restore command after a successful apply.

## Residual risks

- A branch build can still fail or produce unsuitable output if application code has no safe fallback for missing `NEXT_PUBLIC_*` variables.
- Release migration failures leave the service stopped and `.next.prev` available for manual restoration; database migrations may require their own rollback procedure.
- Operators that set neither `PM2_APP` nor `SYSTEMD_UNIT` must stop and restart the application manually.
