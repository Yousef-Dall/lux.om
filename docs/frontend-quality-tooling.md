# Frontend quality tooling

Stage 21I introduces a controlled frontend linting and formatting baseline without rewriting legacy application files.

## Commands

- `npm run lint` runs TypeScript-aware ESLint and Stylelint.
- `npm run lint:code` runs ESLint only.
- `npm run lint:styles` runs Stylelint only.
- `npm run format:check` verifies files listed in `frontend/format-baseline.json`.
- `npm run format` formats only those controlled baseline files.

ESLint applies to all frontend TypeScript, React, browser-test, and frontend tooling files. Existing rule debt is reported as warnings so CI can establish visibility without a repository-wide cleanup. The `--max-warnings 133` ceiling prevents new warning debt and should only move downward as files are improved. Rules-of-Hooks violations remain blocking errors. Type-aware promise checks, React Hooks dependency checks, and JSX accessibility checks are enabled.

Stylelint checks all frontend CSS for invalid syntax, properties, units, selectors, duplicate declarations, and malformed values. It does not impose a formatting rewrite on the existing stylesheet architecture.

## Controlled formatting baseline

Prettier initially owns only tooling files changed by this batch. When a functional patch substantially edits an existing file, format that file deliberately and add it to `frontend/format-baseline.json`. This ratchets formatting coverage forward without obscuring product changes with unrelated churn.

The Prettier configuration uses `endOfLine: auto` so the checks remain compatible with both LF and CRLF Windows worktrees.
