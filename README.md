# Adham Nasr — Portfolio

## Editing your projects

You don't need to touch `js/data.js` by hand anymore. Run the local admin tool:

```bash
node app.js
```

Then open:

- **http://localhost:5173/** — the live site, for previewing changes
- **http://localhost:5173/admin** — the dashboard: add, edit, reorder, and delete projects

No `npm install` needed — `app.js` only uses Node's built-in modules.

Every save writes to `data/projects.json` (the source of truth) and regenerates
`js/data.js` (a plain static file) to match. The category filter chips above
the grid are derived automatically from whichever categories your projects use.

## Deploying

The live site only needs these files:

```
index.html
css/styles.css
js/data.js
js/main.js
```

`app.js`, `lib/`, `admin/`, and `data/projects.json` are local editing tools —
you can leave them out of your deploy (e.g. don't upload them to your static
host) and the site will work exactly the same, since `js/data.js` is a
regular static JS file, not something `app.js` needs to serve at runtime.

## Adding real screenshots

In the admin UI, the **card thumbnail**, **modal cover**, and each
**screenshot** are just URLs. To use your own images:

1. Drop your image files somewhere under the project (e.g. an `images/`
   folder next to `index.html`).
2. In the admin form, point the relevant field at that path, e.g.
   `images/illma-cover.png`.
3. Save — `js/data.js` updates automatically.

Recommended aspect ratios: card thumbnail 16:10, modal cover 16:8,
individual screenshots 4:3.
