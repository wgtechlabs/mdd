---
title: The MDD folder
navTitle: MDD folder
order: 2
---
# The MDD folder

MDD reads one folder in your project. The standard name is `mdd/`.

```text
my-project/
  mdd/
    config.json      # optional
    reader.json      # optional
    footer.md        # optional
    contents/
      index.md       # required homepage
      get-started/
        installation.md
    themes/          # optional
```

A folder is an MDD folder when it has `contents/index.md`. If `config.json` sets `paths.contents`, MDD looks for `index.md` in that folder instead.

## How MDD finds the folder

1. If you set a folder, MDD uses it. Use `MDD_DOCS_DIR` for a mounted project, or `MDD_SOURCE_DIR` for a downloaded repository.
2. If you do not set a folder, MDD uses `mdd/`.
3. If `mdd/` is not an MDD folder, MDD uses `docs/`.
4. If neither folder is an MDD folder, MDD stops with an error. It never serves an empty site.

> [!IMPORTANT]
> MDD does not fall back when you set a folder. If that folder is not an MDD folder, startup fails.

A `docs/` folder of plain Markdown files is not an MDD folder. MDD does not use it.

## Use a custom folder

Set the folder relative to the project root:

```sh
MDD_SOURCE_DIR=examples/basic/mdd
```

The path must stay inside the project. Absolute paths and `..` segments are rejected.

## Read the error

If MDD cannot find a folder, the error names the folders it checked and the missing file:

```text
No MDD folder found. Checked mdd/ and docs/: mdd/ does not exist;
docs/contents/index.md is missing. An MDD folder needs contents/index.md ...
```

Add the missing file, or set the folder variable to your MDD folder.
