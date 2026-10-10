const markdownIt = require("markdown-it");
const fs = require("node:fs");
const path = require("node:path");
const eleventyImage = require("@11ty/eleventy-img");
const Image = eleventyImage.default;
const artworkArchive = require("./src/_data/artworkArchive");
const artworkVocabulary = require("./src/_data/artworkVocabulary");
const taxonomy = require("./src/_data/taxonomy");
const constellations = require("./src/_data/constellations");
const compositeArtworks = require("./src/_data/compositeArtworks");
const { validateArtworkData, validateConstellationGroups } = require("./src/_data/artworkValidation");
const { validateCompositeArtworks } = require("./src/_data/compositeArtworkValidation");
const { relatedArtworks } = require("./src/_data/artworkRelations");

module.exports = function (eleventyConfig) {
  const validation = validateArtworkData(
    require("./src/_data/artworks.json"),
    { ...artworkVocabulary, constellations },
    __dirname
  );
  if (validation.errors.length) {
    throw new Error(`Artwork metadata validation failed:\n- ${validation.errors.join("\n- ")}`);
  }
  const constellationErrors = validateConstellationGroups(
    constellations,
    require("./src/_data/artworks.json"),
    artworkVocabulary.constellations
  );
  if (constellationErrors.length) {
    throw new Error(`Constellation validation failed:\n- ${constellationErrors.join("\n- ")}`);
  }
  const compositeErrors = validateCompositeArtworks(compositeArtworks, require("./src/_data/artworks.json"));
  if (compositeErrors.length) {
    throw new Error(`Composite artwork validation failed:\n- ${compositeErrors.join("\n- ")}`);
  }
  validation.warnings.forEach((warning) => console.warn(`[artwork validation] ${warning}`));

  const imageVariants = {
    thumbnail: {
      widths: [180, 320, 640],
      sizes: "(max-width: 767px) 40vw, 180px",
    },
    card: {
      widths: [320, 640, 960],
      sizes: "(max-width: 767px) 92vw, (max-width: 1279px) 45vw, 320px",
    },
    artwork: {
      widths: [640, 960, 1280, 1920],
      sizes: "(max-width: 767px) 92vw, (max-width: 1279px) 72vw, 960px",
    },
  };
  const imageMetadataCache = new Map();

  eleventyConfig.addNunjucksAsyncShortcode(
    "optimizedImage",
    async function (src, alt, variant = "card", loading = "lazy") {
      if (!src) return "";
      const config = imageVariants[variant] || imageVariants.card;
      const relativePath = String(src).replace(/^\/+/, "");
      const sourceRoot = path.join(__dirname, "src");
      const inputPath = path.resolve(sourceRoot, relativePath);
      if (inputPath !== sourceRoot && !inputPath.startsWith(`${sourceRoot}${path.sep}`)) {
        throw new Error(`Image path "${src}" escapes the source directory.`);
      }
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Cannot optimize missing image "${src}" (${inputPath}).`);
      }

      const cacheKey = `${inputPath}:${variant}`;
      if (!imageMetadataCache.has(cacheKey)) {
        imageMetadataCache.set(
          cacheKey,
          Image(inputPath, {
            widths: config.widths,
            formats: ["webp", "jpeg"],
            outputDir: path.join(__dirname, "_site", "img", "optimized"),
            urlPath: "/img/optimized/",
            filenameFormat: (id, source, width, format) => {
              const basename = path.basename(source, path.extname(source));
              return `${basename}-${id}-${width}w.${format}`;
            },
            sharpJpegOptions: { quality: 78, mozjpeg: true },
            sharpWebpOptions: { quality: 74 },
          })
        );
      }

      const metadata = await imageMetadataCache.get(cacheKey);
      return eleventyImage.generateHTML(metadata, {
        alt: alt || "",
        sizes: config.sizes,
        loading,
        decoding: "async",
        fetchpriority: loading === "eager" ? "high" : "auto",
      });
    }
  );

  function slugify(str) {
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === "") return [];
    return [value];
  }

  // Hard line breaks: a single newline becomes <br>, matching the poem
  // formatting fix from the Hugo site (single line breaks were being
  // silently swallowed by standard Markdown rules).
  const md = markdownIt({ html: true, breaks: true });
  eleventyConfig.setLibrary("md", md);

  // Pass through static assets as-is
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/posts/**/*.jpg");
  eleventyConfig.addPassthroughCopy("src/posts/**/*.png");

  function isArtwork(item) {
    const tags = item.data.tags || [];
    return tags.includes("artwork") || tags.includes("sketch");
  }

  const artworkAltByImagePath = new Map(
    artworkArchive.items.flatMap((artwork) =>
      artwork.assets
        .filter((asset) => asset.role === "primary" && asset.path && asset.alt)
        .map((asset) => [asset.path, asset.alt])
    )
  );

  function normalizeDigitalAssets(item) {
    const rawAssets = Array.isArray(item.data.digitalAssets) ? item.data.digitalAssets : [];
    let assets = rawAssets
      .map((asset) => (typeof asset === "string" ? { src: asset } : asset))
      .filter((asset) => asset && typeof asset.src === "string" && asset.src.trim().length > 0)
      .map((asset) => ({
        src: asset.src,
        alt: asset.alt || artworkAltByImagePath.get(asset.src),
        primary: asset.primary === true,
      }));

    if (assets.length === 0 && typeof item.data.image === "string" && item.data.image.trim().length > 0) {
      assets = [{
        src: item.data.image,
        alt: item.data.description || artworkAltByImagePath.get(item.data.image) || item.data.title,
        primary: true,
      }];
    }

    if (assets.length > 0 && !assets.some((asset) => asset.primary)) {
      assets[0].primary = true;
    }

    const primaryAssetIndex = assets.findIndex((asset) => asset.primary);
    const primaryAsset = primaryAssetIndex >= 0 ? assets[primaryAssetIndex] : null;

    return Object.assign(Object.create(item), {
      data: {
        ...item.data,
        digitalAssets: assets,
        primaryAsset,
        primaryAssetIndex,
        image: primaryAsset ? primaryAsset.src : undefined,
      },
    });
  }

  const canonicalPostsCache = new WeakMap();

  function getCanonicalPosts(collectionApi) {
    if (canonicalPostsCache.has(collectionApi)) {
      return canonicalPostsCache.get(collectionApi);
    }

    const sortedPosts = collectionApi.getFilteredByGlob("src/posts/**/*.md").sort((a, b) => b.date - a.date);
    const seenArtworkIds = new Set();

    const canonicalPosts = sortedPosts
      .map((item) => normalizeDigitalAssets(item))
      .filter((item) => {
        if (!isArtwork(item)) return true;
        const artworkId = item.data.artworkId || item.url;
        if (seenArtworkIds.has(artworkId)) return false;
        seenArtworkIds.add(artworkId);
        return true;
      });

    canonicalPostsCache.set(collectionApi, canonicalPosts);
    return canonicalPosts;
  }

  // "posts" collection, newest first, mirrors Hugo's unified posts stream
  eleventyConfig.addCollection("posts", function (collectionApi) {
    return getCanonicalPosts(collectionApi);
  });

  // Collection filtered to poem-tagged pieces
  eleventyConfig.addCollection("poems", function (collectionApi) {
    return getCanonicalPosts(collectionApi).filter((item) => item.data.tags && item.data.tags.includes("poem"));
  });

  eleventyConfig.addCollection("archiveWriting", function (collectionApi) {
    return getCanonicalPosts(collectionApi).filter((item) => !isArtwork(item));
  });

  function artworkFacetValues(artwork, facet) {
    if (facet === "classification") return [artwork.classification.type];
    if (facet === "curatorialStatus") return [artwork.curatorial_status];
    const field = {
      motif: "motifs",
      theme: "themes",
      constellation: "constellations",
      subject: "subjects",
    }[facet] || facet;
    const values = artwork[field] || [];
    return values.map((value) => (typeof value === "string" ? value : value.id)).filter(Boolean);
  }

  function filterArtworksByFacet(artworks, facet, expectedValues) {
    const expected = toArray(expectedValues).map((value) => String(value).toLowerCase());
    if (!expected.length) return artworks;
    return artworks.filter((artwork) =>
      artworkFacetValues(artwork, facet).some((value) => expected.includes(String(value).toLowerCase()))
    );
  }

  // Canonical records are the sole source for archive and artwork detail routes.
  eleventyConfig.addCollection("artworks", function (collectionApi) {
    return artworkArchive.items;
  });

  eleventyConfig.addCollection("compositeArtworks", function () {
    return artworkArchive.compositeArtworks;
  });

  // Preserve the existing post-based sketches page independently of the catalogue.
  eleventyConfig.addCollection("sketches", function (collectionApi) {
    return getCanonicalPosts(collectionApi).filter(isArtwork);
  });

  eleventyConfig.addFilter("artworksBy", (artworks, facet, value) => {
    return filterArtworksByFacet(artworks || [], facet, value);
  });
  eleventyConfig.addFilter("artworksByClassification", (artworks, value) => {
    return filterArtworksByFacet(artworks || [], "classification", value);
  });
  eleventyConfig.addFilter("artworksByMotif", (artworks, value) => {
    return filterArtworksByFacet(artworks || [], "motif", value);
  });
  eleventyConfig.addFilter("artworksByTheme", (artworks, value) => {
    return filterArtworksByFacet(artworks || [], "theme", value);
  });
  eleventyConfig.addFilter("artworksByConstellation", (artworks, value) => {
    return filterArtworksByFacet(artworks || [], "constellation", value);
  });
  eleventyConfig.addFilter("artworksByCuratorialStatus", (artworks, value) => {
    return filterArtworksByFacet(artworks || [], "curatorialStatus", value);
  });
  eleventyConfig.addFilter("artworkTermId", (term) => (typeof term === "string" ? term : term && term.id));
  eleventyConfig.addFilter("artworkTermIds", (terms) =>
    (terms || []).map((term) => (typeof term === "string" ? term : term && term.id)).filter(Boolean)
  );
  eleventyConfig.addFilter("artworkTermLabel", (id, field) => {
    const values = artworkVocabulary[field] || [];
    const term = values.find((value) => value.id === id);
    return term ? term.label : id;
  });
  eleventyConfig.addFilter("artworkAltForImage", (src, fallback) => artworkAltByImagePath.get(src) || fallback || "");
  eleventyConfig.addFilter("compositeByUrl", (composites, url) =>
    (composites || []).find((composite) => composite.url === url)
  );
  eleventyConfig.addFilter("artworkBySlug", (artworks, slug) => (artworks || []).find((item) => item.slug === slug));
  eleventyConfig.addFilter("artworkById", (artworks, artworkId) =>
    (artworks || []).find((item) => item.artwork_id === artworkId)
  );
  eleventyConfig.addFilter("relatedArtworks", (artworks, current, explicitLimit = 4, semanticLimit = 4) =>
    relatedArtworks(artworks || [], current, explicitLimit, semanticLimit)
  );

  // Curated collection landing page: works explicitly marked as anchors
  // in front matter, ordered by metadata first and date second.
  eleventyConfig.addCollection("anchorWorks", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/posts/**/*.md")
      .filter((item) => item.data.anchorWork === true)
      .sort((a, b) => {
        const aOrder = a.data.anchorOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.data.anchorOrder ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        return b.date - a.date;
      });
  });

  // Tag list helper, mirrors Hugo's /tags/ pages
  eleventyConfig.addCollection("tagList", function (collectionApi) {
    const tagSet = new Set();
    collectionApi.getFilteredByGlob("src/posts/**/*.md").forEach((item) => {
      (item.data.tags || []).forEach((tag) => tagSet.add(tag));
    });
    return [...tagSet].sort();
  });

  eleventyConfig.addCollection("archiveCounts", function (collectionApi) {
    return [{ artworks: artworkArchive.count, assets: artworkArchive.assetCount }];
  });

  eleventyConfig.addCollection("taxonomyBrowsePages", function (collectionApi) {
    const pages = [];

    Object.entries(taxonomy).forEach(([group, entries]) => {
      entries.forEach((entry) => {
        const matches = toArray(entry.match || entry.value).map(slugify);
        const matchingArtworks = artworkArchive.items.filter((artwork) => {
          const values = entry.field === "classification"
            ? [artwork.classification.type]
            : artworkFacetValues(artwork, entry.field);
          return values.map(slugify).some((value) => matches.includes(value));
        });

        if (matchingArtworks.length === 0) return;

        pages.push({
          group,
          slug: slugify(entry.value),
          label: entry.label || entry.value,
          count: matchingArtworks.length,
          artworks: matchingArtworks,
        });
      });
    });

    return pages;
  });

  eleventyConfig.addCollection("constellationPages", function () {
    const artworkBySlug = new Map(artworkArchive.items.map((artwork) => [artwork.slug, artwork]));
    return artworkArchive.constellations.map((constellation) => ({
      ...constellation,
      artworks: constellation.artworkSlugs.map((slug) => artworkBySlug.get(slug)).filter(Boolean),
    }));
  });

  eleventyConfig.addCollection("sitemapEntries", function (collectionApi) {
    const routes = new Set();
    collectionApi.getAll().forEach((item) => {
      const url = item.url;
      if (!url || url === "/search-index.json" || url === "/sitemap.xml" || url.startsWith("/artwork/")) return;
      routes.add(url);
    });
    artworkArchive.items.forEach((artwork) => routes.add(artwork.url));
    Object.entries(taxonomy).forEach(([group, entries]) => {
      entries.forEach((entry) => {
        const values = toArray(entry.match || entry.value).map(slugify);
        const count = artworkArchive.items.filter((artwork) => {
          const facetValues = entry.field === "classification"
            ? [artwork.classification.type]
            : artworkFacetValues(artwork, entry.field);
          return facetValues.map(slugify).some((value) => values.includes(value));
        }).length;
        if (count) routes.add(`/${group}/${slugify(entry.value)}/`);
      });
    });
    artworkArchive.constellations.forEach((constellation) => {
      routes.add(`/constellations/${constellation.slug}/`);
    });
    const tags = new Set();
    getCanonicalPosts(collectionApi).forEach((post) => (post.data.tags || []).forEach((tag) => tags.add(tag)));
    tags.forEach((tag) => routes.add(`/tags/${slugify(tag)}/`));
    return [...routes].sort();
  });

  // Shared homepage layout logic: figures out the hero, the next 3
  // "recent" posts, and one highlight per tag - making sure none of the
  // three sections repeat the same post.
  function computeHomepageLayout(collectionApi) {
    const posts = getCanonicalPosts(collectionApi);
    const hero = posts.find((p) => p.data.featured === true) || posts[0];
    const used = new Set(hero ? [hero.url] : []);

    const recent = posts.filter((p) => !used.has(p.url)).slice(0, 3);
    recent.forEach((p) => used.add(p.url));

    const tagSet = new Set();
    posts.forEach((item) => (item.data.tags || []).forEach((t) => tagSet.add(t)));
    const highlights = [];
    const perTagLimit = 2;
    [...tagSet].sort().forEach((tag) => {
      const candidates = posts.filter((p) => (p.data.tags || []).includes(tag));
      let count = 0;
      candidates.forEach((p) => {
        if (count >= perTagLimit || used.has(p.url)) return;
        highlights.push({ tag, post: p });
        used.add(p.url);
        count++;
      });
    });

    // Anything still unused after the above (e.g. a piece whose tags were
    // all already spoken for) gets one more pass, grouped under its first tag,
    // so nothing in the archive stays permanently hidden from the homepage.
    posts.forEach((p) => {
      if (used.has(p.url)) return;
      const tag = (p.data.tags || [])[0] || "more";
      highlights.push({ tag, post: p });
      used.add(p.url);
    });

    return { hero, recent, highlights };
  }

  // One highlight per tag: the newest post carrying each tag, preferring
  // posts not already shown as the hero or in the recent feed, so the
  // homepage never repeats the same piece across its three sections.
  eleventyConfig.addCollection("highlightsByTag", function (collectionApi) {
    return computeHomepageLayout(collectionApi).highlights;
  });

  // Featured post for the homepage hero: the post with `featured: true`
  // in its front matter, if one is set; otherwise the newest post.
  eleventyConfig.addCollection("featuredPost", function (collectionApi) {
    const hero = computeHomepageLayout(collectionApi).hero;
    return hero ? [hero] : [];
  });

  // Recent posts feed: the 3 posts shown in the homepage's left column,
  // already excluding the hero and never repeated in the tag column.
  eleventyConfig.addCollection("recentPosts", function (collectionApi) {
    return computeHomepageLayout(collectionApi).recent;
  });

  // Human-readable date filter
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });
  eleventyConfig.addFilter("htmlDateString", (dateObj) => new Date(dateObj).toISOString().slice(0, 10));
  eleventyConfig.addFilter("yearNumber", (value) => {
    if (typeof value === "string") {
      const match = value.match(/^(\d{4})/);
      if (match) return match[1];
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : String(date.getFullYear());
  });

  // Slugify filter for tag URLs
  eleventyConfig.addFilter("slugify", slugify);
  eleventyConfig.addFilter("absoluteUrl", (url, base) => {
    if (!url) return "";
    return new URL(url, base).toString();
  });

  // Related posts for the single-post sidebar: posts sharing at least one
  // tag with the current post, newest first, excluding the post itself.
  // Backfills with the most recent other posts if there aren't enough.
  eleventyConfig.addFilter("relatedPosts", (posts, currentUrl, currentTags, limit) => {
    limit = limit || 4;
    const tags = currentTags || [];
    const others = posts.filter((p) => p.url !== currentUrl);
    const shared = others.filter((p) => (p.data.tags || []).some((t) => tags.includes(t)));
    const result = [...shared];
    if (result.length < limit) {
      others.forEach((p) => {
        if (result.length >= limit) return;
        if (!result.includes(p)) result.push(p);
      });
    }
    return result.slice(0, limit);
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
