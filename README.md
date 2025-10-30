# Psychic Chainsaw Arcade Library

This repository collects a set of browser-based arcade experiments that all run off the shared `game-lib/` engine. The landing page provides a searchable, filterable index that launches each game in its own HTML file.

## Local development

You do not need heavy build tooling. Serve the repository root with a static file server and open `http://localhost:8000/`:

```bash
python -m http.server 8000
```

All assets are referenced with relative URLs, so any simple HTTP server will do. Update `games.json` to curate which games appear on
the landing page — it powers the search UI and can be edited directly in GitHub’s interface.

## GitHub Pages deployment

GitHub Pages is configured via GitHub Actions. The workflow in `.github/workflows/pages.yml` rebuilds the static site and publishes the
result, ensuring the `docs/` folder stays in sync with the source files.

1. Go to **Settings → Pages** for the repository.
2. Set **Source** to **GitHub Actions**.
3. Save the changes. Pages will build and your site will be available at `https://<username>.github.io/psychic-chainsaw/`.

When you update files in the root of the repository, run `node scripts/build.js` (or `npm run build` if you prefer) to regenerate the
`docs/` folder for local preview. The automated deployment does this for every push.

If you prefer using a `gh-pages` branch, you can delete the `docs/` folder and publish the repository contents with any static site deployment workflow.

## Troubleshooting

If you receive a 404 after enabling GitHub Pages:

- Confirm that the deployment source is `main`/`master` with the `/docs` folder.
- Wait a few minutes for GitHub Pages to finish building the site; the status indicator appears at the top of the **Settings → Pages** screen.
- Make sure the repository is public. Private repositories require GitHub Pro or higher for Pages.

With Pages configured correctly the landing page (`index.html`) and every game entry point (`*.html`) should load without additional setup.
