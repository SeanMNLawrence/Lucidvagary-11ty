# Lucidvagary-11ty

<img width="1194" height="834" alt="image" src="https://github.com/user-attachments/assets/d96d1911-18c4-4c90-b603-8787fca4c0f5" />

Lucid Vagary

A digital art archive for exploring images, recurring motifs, and the relationships between works.

Lucid Vagary organizes an evolving artwork collection through a shared taxonomy and a lightweight ontology. The taxonomy supports consistent classification; the ontology describes connections among artworks, digital assets, themes, and curated groupings.

The project brings together structured cataloging and interpretive exploration. Visitors can browse by visual subject, follow recurring motifs, or encounter works in constellations—overlapping collections that reveal connections through deliberate juxtaposition.

Purpose

* Maintain a canonical record for each artwork, independently of its image files.
* Make the collection discoverable through consistent metadata and navigation.
* Preserve provenance and distinguish alternate assets from distinct works.
* Support curatorial interpretation without reducing images to fixed meanings.
* Provide an extensible foundation for future artwork, writing, and exhibitions.

Data Model

Layer	Purpose	Vocabulary or structure
Artwork	The work being cataloged	One canonical record per artwork
Digital Asset	A file representing an artwork	Images, alternate exports, and other associated files
Subject Family	Broad visual classification	Visages & Masks; Eyes & Gaze; Hands & Gesture; Figures & Bodies; Animals & Hybrids; Symbols & Cosmograms; Composite Worlds
Making State	Developmental classification	Drawing; Sketch; Indeterminate
Curatorial Status	Role within the collection	Anchor; Supporting; Study; Variant; Fragment
Motif	A recurring visual element	Eyes, masks, horns, hands, glyphs, and other evolving terms
Theme	A conceptual or psychological concern	Transformation, fragmentation, gaze, liminality, and other developing concepts
Constellation	An overlapping, curated grouping	Hybrid Bestiary; Inner Cosmologies; Chromatic Visions; other groupings
Relationship	An explicit connection between artworks	Typed links using a developing relationship vocabulary
Provenance	Origin and record history	Sources, lineage, asset history, and catalog information

An artwork can contain multiple motifs, participate in multiple themes, and belong to multiple constellations. It can also connect directly to other artworks and be represented by more than one digital asset.

Classification and Curation

Each layer answers a different question:

* Subject: What is depicted?
* Motif: What visual elements recur?
* Theme: What conceptual territory does the work explore?
* Constellation: What becomes visible when these works are viewed together?
* Relationship: How is this work connected to another?

For example, Animals & Hybrids classifies visual subject matter. Hybrid Bestiary can gather creatures, masks, bodily fragments, and symbolic compositions into a broader curatorial exploration.

Constellations overlap by design. Classification provides orientation while leaving room for ambiguity, reinterpretation, and new associations.

Website Architecture

The proposed website uses Eleventy, with source control in GitHub and deployment through Cloudflare Pages.

Planned routes include:

/artwork/{slug}/
/archive/
/collection/
/collection/drawings/
/collection/sketches/
/subjects/{slug}/
/constellations/{slug}/
/themes/{slug}/

Shared vocabulary and relationship definitions are maintained centrally:

_data/
  artwork-taxonomy.json
  artwork-ontology.json

Artwork records use structured Markdown front matter or JSON/YAML. These records provide the basis for generating artwork pages, collection views, subject and theme indexes, constellation pages, and links between related works.

Visitor Experience

The public interface makes the collection approachable through images, concise descriptions, and meaningful connections. Structured metadata supports navigation, while curatorial text gives each constellation context.

The goal is a navigable visual archive in which an artwork can acquire new meaning through the company it keeps.

Development Status

This document describes the working model and intended architecture. Vocabulary, relationship types, curatorial groupings, and public presentation remain subject to refinement. It does not establish which features are currently implemented or deployed.
