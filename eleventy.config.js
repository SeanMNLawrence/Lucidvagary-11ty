const markdownIt = require("markdown-it");

module.exports = function (eleventyConfig) {
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

  function normalizeDigitalAssets(item) {
    const rawAssets = Array.isArray(item.data.digitalAssets) ? item.data.digitalAssets : [];
    let assets = rawAssets
      .map((asset) => (typeof asset === "string" ? { src: asset } : asset))
      .filter((asset) => asset && typeof asset.src === "string" && asset.src.trim().length > 0)
      .map((asset) => ({
        src: asset.src,
        alt: asset.alt,
        primary: asset.primary === true,
      }));

    if (assets.length === 0 && typeof item.data.image === "string" && item.data.image.trim().length > 0) {
      assets = [{ src: item.data.image, alt: item.data.description || item.data.title, primary: true }];
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

  const ARTWORK_ALT_STATUSES = new Set([
    "alternate",
    "alternate-asset",
    "alternate_asset",
    "alt",
    "variant",
  ]);

  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null) return [];
    return [value];
  }

  function normalizeFacetValue(value) {
    return String(value).trim().toLowerCase();
  }

  function getArtworkFacetValues(item, facet) {
    const data = item.data || {};
    const artwork = data.artwork || {};
    const keys = {
      classification: ["classification"],
      motif: ["motif", "motifs"],
      theme: ["theme", "themes"],
      constellation: ["constellation", "constellations"],
      subject: ["subject", "subjects"],
    };

    function getValues(source, fieldNames) {
      return fieldNames.flatMap((fieldName) => {
        const value = source[fieldName];
        if (
          fieldName === "classification" &&
          value &&
          typeof value === "object" &&
          typeof value.type === "string"
        ) {
          return value.type;
        }
        return toArray(value);
      });
    }

    if (facet === "curatorialStatus") {
      return toArray(
        data.curatorialStatus ||
          (data.curatorial && data.curatorial.status) ||
          artwork.curatorialStatus ||
          (artwork.curatorial && artwork.curatorial.status)
      );
    }
    const fieldNames = keys[facet] || [facet];
    return getValues(data, fieldNames).concat(getValues(artwork, fieldNames));
  }

  function isCanonicalArtworkEntry(item) {
    const data = item.data || {};
    const artwork = data.artwork || {};
    const curatorialStatus = getArtworkFacetValues(item, "curatorialStatus")
      .map(normalizeFacetValue)
      .find(Boolean);

    if (curatorialStatus && ARTWORK_ALT_STATUSES.has(curatorialStatus)) return false;
    if (data.isAlternateAsset === true || artwork.isAlternateAsset === true) return false;
    if (data.alternateOf || artwork.alternateOf) return false;
    if (data.variantOf || artwork.variantOf) return false;
    return true;
  }

  function buildArtworkCollection(collectionApi) {
    const seen = new Set();
    return [
      ...collectionApi.getFilteredByGlob("src/artwork/**/*.md").map((item) => normalizeDigitalAssets(item)),
      ...getCanonicalPosts(collectionApi).filter((item) => isArtwork(item)),
    ]
      .filter((item) => {
        const key = item.data.artworkId || item.data.slug || item.fileSlug || item.url || item.inputPath;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .filter(isCanonicalArtworkEntry)
      .sort((a, b) => b.date - a.date);
  }

  function filterArtworksByFacet(artworks, facet, expectedValues) {
    const values = toArray(expectedValues).map(normalizeFacetValue).filter(Boolean);
    if (!values.length) return artworks;
    return artworks.filter((item) => {
      const facets = getArtworkFacetValues(item, facet)
        .map(normalizeFacetValue)
        .filter(Boolean);
      return values.some((value) => facets.includes(value));
    });
  }

  // Canonical artwork collection, excluding alternate assets.
  eleventyConfig.addCollection("artworks", function (collectionApi) {
    return buildArtworkCollection(collectionApi);
  });

  // Backward-compatible alias for the sketches index page.
  eleventyConfig.addCollection("sketches", function (collectionApi) {
    return buildArtworkCollection(collectionApi);
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
    const artworks = getCanonicalPosts(collectionApi).filter((item) => isArtwork(item));
    const assetCount = artworks.reduce((count, item) => count + ((item.data.digitalAssets || []).length || 0), 0);
    return [{ artworks: artworks.length, assets: assetCount }];
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

  // Slugify filter for tag URLs
  eleventyConfig.addFilter("slugify", (str) => {
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
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
