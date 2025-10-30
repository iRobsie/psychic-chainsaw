# Psychic Chainsaw Arcade Library

This repository collects a set of browser-based arcade experiments that all run off the shared `game-lib/` engine. The landing page provides a searchable, filterable index that launches each game in its own HTML file.

## Local development

You do not need any build tooling. Serve the repository root with a static file server and open `http://localhost:8000/`:

```bash
python -m http.server 8000
```

All assets are referenced with relative URLs, so any simple HTTP server will do.

## GitHub Pages deployment

GitHub Pages can publish straight from the `docs/` folder. The `docs` directory in this repository mirrors the content in the repository root and also contains a `.nojekyll` marker so the raw JavaScript modules load without Jekyll processing.

1. Go to **Settings → Pages** for the repository.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Set the branch to `main` (or `master`, depending on your default branch) and the folder to `/docs`.
4. Save the changes. Pages will build and your site will be available at `https://<username>.github.io/psychic-chainsaw/`.

When you update files in the root of the repository, copy the changes into `docs/` as well so the published version stays in sync. You can automate this with a simple script if you make frequent updates.

If you prefer using a `gh-pages` branch, you can delete the `docs/` folder and publish the repository contents with any static site deployment workflow.

## Troubleshooting

If you receive a 404 after enabling GitHub Pages:

- Confirm that the deployment source is `main`/`master` with the `/docs` folder.
- Wait a few minutes for GitHub Pages to finish building the site; the status indicator appears at the top of the **Settings → Pages** screen.
- Make sure the repository is public. Private repositories require GitHub Pro or higher for Pages.

With Pages configured correctly the landing page (`index.html`) and every game entry point (`*.html`) should load without additional setup.
