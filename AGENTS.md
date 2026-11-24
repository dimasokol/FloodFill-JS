# AGENTS.md

Instructions for AI agents (and humans) working in this repository. Follow them strictly.

## Project

A JavaScript library implementing the **flood fill** algorithm.

## Git: general rules

- The project is under Git version control.
- **All commits must be atomic**: one commit to one logically complete change. 
  Do not mix unrelated edits (e.g. a bug fix and a refactor) in a single commit.
- **Commit messages must state the essence and purpose** of the change: what was changed and why. 
  Avoid empty messages like `fix`, `update`, `changes`.
- Before committing, make sure the changes don't break the build and leave no unfinished fragments.

## Branches

The repository has two main branches:

| Branch     | Purpose                                                                                     |
|------------|---------------------------------------------------------------------------------------------|
| `master`   | Current, up-to-date, maintained code. The main working branch.                              |
| `classic`  | The 2012 version. Uses old JavaScript — **no modern keywords or concepts**.                 |

### `classic` branch specifics

The `classic` code must stay authentic to the 2012 version. Do not use:

- `let` / `const` (use `var` only);
- arrow functions;
- `class` and class syntax;
- template literals;
- destructuring;
- default parameters;
- `Promise`, `async`/`await`;
- `import`/`export` modules (use patterns typical of that era);
- any other ES2015+ features.

Do not modernize `classic` — it is a deliberately frozen historical version.

## `demo` directory

The `demo` directory holds a usage example — a simple graphics editor.

- The demo **must match the current branch**: if you change the library's API or behavior in `master` or `classic`, 
  update `demo` accordingly in the same commit.
- `demo` is the library's showcase; it must stay working and up to date.

## Workflow

1. Determine which branch you're working on (`master` or `classic`) and follow its rules.
2. Make changes in small atomic steps.
3. Write meaningful commit messages for each commit: essence + purpose.
4. If a change affects the public API in `master`, sync `demo`.
5. In the `classic` branch, do not use modern JavaScript syntax.
