# Agent Guide – Neobrutalism UI

- **Always use the Neobrutalism shadcn registry** for any new UI. Prefer existing components in `components/ui`. If missing, install via shadcn CLI, e.g.:
  ```
  pnpm dlx shadcn@latest add <component> --registry https://raw.githubusercontent.com/ekmas/neobrutalism-components/main/registry.json
  ```
- **Keep the global styling** in `app/globals.css` as-is; it contains the official neobrutalism theme from https://www.neobrutalism.dev/docs/installation.
- **No ad-hoc CSS frameworks or component libraries.** Extend styles with utility classes consistent with the current theme if absolutely necessary.
- **Documentation first.** When unsure about variants or available components, check the docs at https://www.neobrutalism.dev/docs and copy the shadcn CLI command shown there.
- **Use pnpm.** All shadcn installs and dependency additions should use `pnpm` to stay consistent with the repo.
- **Firebase security rules are mandatory.** When adding or changing any Realtime Database or Firestore usage, update and review the corresponding security rules before shipping (lock down by default; only open paths that are explicitly needed).

## Firebase setup (Auth + Firestore only)

- Realtime Database is not used; only Firestore and Firebase Auth are initialized in `lib/firebase.ts`.
- Admins authenticate via Firebase Auth email/password. Admin-specific helpers live in `lib/auth.ts`.
- Kids do **not** use Firebase Auth. Their login records are Firestore documents under `children/{childId}` managed by admins.
- Types and typed references:
  - `lib/types.ts` defines `AdminProfile` and `ChildAccount`.
  - `lib/collections.ts` exports `adminCollection`, `childrenCollection`, `adminDoc`, `childDoc`, and `childBySeatQuery`.
- Child account helpers (hashing, creation, verification) are in `lib/child-accounts.ts`. Passwords are salted SHA-256 hashes; salts generated client-side with Web Crypto.
- Firestore rules (`firestore.rules`):
  - Access is admin-only. Admin status is granted by presence of `admins/{uid}`.
  - `children/{childId}` is readable/writable only by admins; first admin must be seeded manually (Auth user + `admins/{uid}` doc).
- When adding data features, keep children behind an admin-mediated API/server action; never open Firestore rules to unauthenticated users.
