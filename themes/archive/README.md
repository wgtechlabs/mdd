# D Theme history

Keep historical D Theme source snapshots here when a new major theme generation
replaces the current one. The active source always lives in `themes/d/`.

At the next major transition, copy the final D26 source into
`themes/archive/d26/<final-version>/`, including `theme.css`, `theme.json`, and
`CHANGELOG.md`. Preserve that snapshot's version and release name. Then develop
D27 as D Theme 1.0.0 in `themes/d/` and document the changes in its changelog.
Minor and patch updates retain their current release name. Changing the year
never changes the active theme or its identity automatically.

No historical snapshot exists yet. Archive contents are source references and
are excluded from the published MDD package. The CLI selects the current bundled
D Theme through `--theme d`; archived snapshots are not independently selectable
or automatically installed. Any deliberate historical fix must get a new
versioned snapshot; do not silently change a released snapshot.
