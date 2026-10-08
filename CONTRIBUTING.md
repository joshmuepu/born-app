# Contributing

## Keep the manual in sync

The user manual lives in `docs/manual/v2/` (Markdown, single source of truth —
rendered in-app via Help/F1, and printable to PDF from the same content). It is
part of the product, not an afterthought.

**Any user-facing change — a new feature, a renamed button, a changed warning
message, a moved control — must update the manual and its screenshots in the same
change.** There's no automated staleness check for this; it's enforced by this
rule, the same discipline as updating tests.

To refresh screenshots after a UI change, see `docs/manual/v2/README.md` for the
regeneration process.
