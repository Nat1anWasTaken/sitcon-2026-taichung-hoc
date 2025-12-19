# Agent Guide – Neobrutalism UI

- **Always use the Neobrutalism shadcn registry** for any new UI. Prefer existing components in `components/ui`. If missing, install via shadcn CLI, e.g.:
    ```
    pnpm dlx shadcn@latest add <component> --registry https://raw.githubusercontent.com/ekmas/neobrutalism-components/main/registry.json
    ```
- **Keep the global styling** in `app/globals.css` as-is; it contains the official neobrutalism theme from https://www.neobrutalism.dev/docs/installation.
- **No ad-hoc CSS frameworks or component libraries.** Extend styles with utility classes consistent with the current theme if absolutely necessary.
- **Documentation first.** When unsure about variants or available components, check the docs at https://www.neobrutalism.dev/docs and copy the shadcn CLI command shown there.
- **Use pnpm.** All shadcn installs and dependency additions should use `pnpm` to stay consistent with the repo.
- **MongoDB migration in progress.** Firestore is being phased out; new data work should target MongoDB per `MIGRATION_PLAN.md`.
- **Auth model:** Admins log in via Firebase Auth email/password (`lib/auth.ts`); children are not Firebase-authenticated and exist only as data records (seat number/name). No need to worry about admin permission checks for children records while migrating.

## Neobrutalism shadcn registry notes (CLI quirks)

- The `shadcn add` command does **not** support a `--registry` flag. Pass the registry URL directly as the component argument, e.g. `pnpm dlx shadcn@latest add https://v3.neobrutalism.dev/r/button.json`.
- The neobrutalism registry endpoint that worked: `https://v3.neobrutalism.dev/r/<component>.json` (e.g. `button.json`). The previously documented `--registry https://raw.githubusercontent.com/ekmas/neobrutalism-components/main/registry.json` pattern fails with “unknown option '--registry'`.
- Prefer existing components in `components/ui`; add new ones via the URL form above to stay on the neobrutalism set.

## Firebase setup (Auth only, migration to MongoDB)

- Realtime Database is not used; Firebase is only used for Auth in `lib/firebase.ts`.
- Admins authenticate via Firebase Auth email/password. Admin-specific helpers live in `lib/auth.ts`.
- Kids do **not** use Firebase Auth. Their login records live in the `children` collection (currently Firestore during migration; will move to MongoDB), including seat number, name, `passwordSalt`, and `passwordHash`.
- Types and typed references:
    - `lib/types.ts` defines `AdminProfile` and `ChildAccount`.
    - `lib/collections.ts` exports `adminCollection`, `childrenCollection`, `adminDoc`, `childDoc`, and `childBySeatQuery`.
- Child account helpers (hashing, creation, verification) are in `lib/child-accounts.ts`. Passwords are salted SHA-256 hashes; salts generated client-side with Web Crypto.
- Firestore rules are temporary while migration is underway; do not invest in new Firestore permission work.
