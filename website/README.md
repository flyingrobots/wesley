# Wesley Website

The `website/` directory contains the static assets deployed to the public GitHub Pages site.

## Editing the site

1. Update `index.html`, `styles.css`, or add additional assets (images, scripts, etc.).
2. Commit the changes to `main` (or open a PR).  
   The `docs-site` workflow uploads everything under `website/` and publishes it via GitHub Pages.

## Local preview

Use any static file server:

```bash
npx serve website
# or
python -m http.server --directory website 8000
```

Then browse to <http://localhost:3000> (or `:8000`) to preview.

## Deployment

The GitHub Actions workflow `.github/workflows/docs-site.yml` handles deployment:

1. Uploads the `website/` directory as a Pages artifact.
2. Deploys that artifact to the `gh-pages` branch via `actions/deploy-pages`.

No MkDocs build is involved—what you add to `website/` is exactly what gets published.
