# pdl-web

A lightweight, static web interface for composing Policy Decision Language (PDL)
rules. This project provides a visual rule builder, live PDL output, and a
scratchpad for manual edits.

## What it is

- Interactive rule builder for PDL (allow/deny, clauses, groups, AND/OR)
- Live-generated PDL output with copy support
- Built-in sample context and operator cheat sheet
- No build step; runs directly in the browser


## Project structure

- `index.html` - App shell, Tailwind config, and font imports
- `app.js` - React app (rule builder + DSL generation)

## Notes

- The UI is intentionally static for easy hosting (GitHub Pages, S3, etc.).

