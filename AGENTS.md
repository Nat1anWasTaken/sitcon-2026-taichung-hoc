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
