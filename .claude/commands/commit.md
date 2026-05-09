Analyse all current git changes and create multiple focused commits by grouping related changes together.

## Steps

1. Run `git status` and `git diff` to identify all unstaged and staged changes
2. Analyse the changes and group them by logical concern (e.g. match report UI, webhook handler, auth flow, schema changes)
3. For each group, stage only the relevant files using `git add <files>`
4. Write a commit message following the template below, then commit
5. Repeat for each group until all changes are committed

## Commit Message Template
Where `<type>` is one of:
- `feat` — a new feature (e.g. new page, new AI analysis, new card type)
- `fix` — a bug fix (e.g. score calculation error, broken invite flow)
- `docs` — documentation changes (README, brief, technical notes)
- `style` — UI/styling-only changes with no logic changes
- `refactor` — code restructuring that neither fixes a bug nor adds a feature
- `db` — Prisma schema changes, migrations, or seed data
- `chore` — build/config/dependency/maintenance tasks (e.g. .gitignore, package.json, env vars)

## Commit Message Rules

- Use imperative mood (e.g., "Add nudge button to project page")
- Start subject with uppercase
- No trailing period
- Keep subject within 72 characters
- Do NOT group unrelated changes into one commit just to reduce the number of commits

## Examples

- `feat: Add Match Report page with card display`
- `feat: Add GitHub contribution source sync`
- `feat: Add Jira webhook endpoint for Make.com integration`
- `fix: Correct contribution score calculation on report publish`
- `fix: Prevent duplicate invite emails for existing members`
- `db: Add JIRA to ContributionSourceType enum`
- `refactor: Extract score recompute logic into shared util`
- `chore: Add packageManager field to enforce pnpm version`
- `chore: Update .gitignore for .idea and brief folder`