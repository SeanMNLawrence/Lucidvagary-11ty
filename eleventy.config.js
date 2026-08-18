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

  // "posts" collection, newest first, mirrors Hugo's unified posts stream
  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/**/*.md").sort((a, b) => {
      return b.date - a.date;
    });
  });

  // Collection filtered to poem-tagged pieces
  eleventyConfig.addCollection("poems", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/posts/**/*.md")
      .filter((item) => item.data.tags && item.data.tags.includes("poem"))
      .sort((a, b) => b.date - a.date);
  });

  // Tag list helper, mirrors Hugo's /tags/ pages
  eleventyConfig.addCollection("tagList", function (collectionApi) {
    const tagSet = new Set();
    collectionApi.getFilteredByGlob("src/posts/**/*.md").forEach((item) => {
      (item.data.tags || []).forEach((tag) => tagSet.add(tag));
    });
    return [...tagSet].sort();
  });

  // One highlight per tag: the newest post carrying each tag.
  // Used for the homepage's "most interesting from each tag" column.
  eleventyConfig.addCollection("highlightsByTag", function (collectionApi) {
    const posts = collectionApi
      .getFilteredByGlob("src/posts/**/*.md")
      .sort((a, b) => b.date - a.date);
    const tagSet = new Set();
    posts.forEach((item) => (item.data.tags || []).forEach((t) => tagSet.add(t)));
    const highlights = [];
    [...tagSet].sort().forEach((tag) => {
      const match = posts.find((p) => (p.data.tags || []).includes(tag));
      if (match) highlights.push({ tag, post: match });
    });
    return highlights;
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
