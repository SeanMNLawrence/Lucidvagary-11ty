# Lucidvagary-11ty

<img width="1194" height="834" alt="image" src="https://github.com/user-attachments/assets/d96d1911-18c4-4c90-b603-8787fca4c0f5" />

## Data model

Canonical artwork schema: `/src/_data/artwork.schema.json`.
Use this schema to validate artwork records and their nested digital assets before adding or transforming artwork content.
The schema uses JSON Schema draft 2020-12.

The canonical catalogue is `src/_data/artworks.json`; controlled terms are in `src/_data/artworkVocabulary.js`. Primary digital assets require authored visual alt text in the catalogue; schema and build validation reject missing descriptions, and the site checker verifies that artwork pages render the catalogue text. Run `npm run validate:artwork` to validate metadata and local assets, `npm test` for catalogue/relationship checks, and `npm run build && npm run check:site` for the production build and generated-site link, image, heading, route, and sitemap checks.

Two alternate source photographs are recorded by original filename but are not present in this repository. Validation reports them as warnings, and pages do not render broken links for those unavailable files.
