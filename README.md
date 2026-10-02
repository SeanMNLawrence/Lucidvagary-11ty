# Lucidvagary-11ty

<img width="1194" height="834" alt="image" src="https://github.com/user-attachments/assets/d96d1911-18c4-4c90-b603-8787fca4c0f5" />

Here’s the most concrete Lucid Vagary taxonomy/ontology model we had reached around September 15, 2026. I’m separating what was effectively settled from what was still being refined.

Layer	Purpose	Working vocabulary / structure	Status
Artwork	The intellectual/curatorial work	One canonical artwork record, regardless of how many files represent it	Core model
Digital Asset	The actual image/file	JPG/PNG/etc. connected to an Artwork; alternates and variants can point back to the same work	Core model
Subject Family	Primary visual/formal classification	Visages & Masks · Eyes & Gaze · Hands & Gesture · Figures & Bodies · Animals & Hybrids · Symbols & Cosmograms · Composite Worlds	Working controlled vocabulary
Making State	What kind of artifact it is developmentally	Drawing · Sketch · Indeterminate	Controlled vocabulary
Curatorial Status	Importance/function within the archive	Anchor · Supporting · Study · Variant · Fragment	Controlled vocabulary
Motifs	Repeated visual elements	Smaller-grain recurring things within works—eyes, masks, horns, hands, glyphs, etc.	Open vocabulary / still developing
Themes	Conceptual/psychological concerns	Higher-order ideas cutting across subjects and motifs	Separate semantic layer; vocabulary still developing
Constellations	Curated many-to-many groupings	Candidates included Eyes & Gaze, Visages & Masks, Hands & Gesture, Hybrid Bestiary, Inner Cosmologies, Chromatic Visions	Model established; names still somewhat fluid
Relationships	Explicit links among works	Typed artwork-to-artwork relationships rather than relying only on tags	Model established; exact relationship vocabulary not fully recoverable
Provenance	Record history	Origin, asset source, alternates, lineage, and related catalog information	Part of canonical schema

The important distinction

The system was deliberately becoming more than a tag taxonomy.

The architecture was roughly:

Artwork
→ classified by Subject Family
→ described by Making State + Curatorial Status
→ contains Motifs
→ participates in Themes
→ belongs to one or more Constellations
→ relates explicitly to other Artworks
→ is represented by one or more Digital Assets

That distinction between Artwork and Digital Asset was important because the working inventory appeared to contain 64 source assets representing about 62 artworks. In other words, duplicate files, alternates, or versions were not supposed to inflate the intellectual collection.

Taxonomy versus constellation

This was probably the most important conceptual move we made.

A Subject Family answers:

What kind of visual thing is this?

For example:

Animals & Hybrids

A Motif answers:

What recurs inside it?

For example:

horns · eyes · teeth · smoke · glyphs

A Theme answers:

What psychological or conceptual territory does it inhabit?

For example:

transformation · fragmentation · gaze · liminality

A Constellation answers:

Which works become interesting when deliberately viewed together?

So Hybrid Bestiary isn’t simply another folder containing Animals & Hybrids. It can gather creatures, masks, bodily fragments, symbols, and composite scenes into a curatorial argument.

That is the more archetypalist part of the system: constellations are allowed to overlap.

⸻

The website architecture that followed from it

We had translated the taxonomy into an Eleventy structure roughly like this:

/artwork/{slug}/
/archive/
/collection/
/collection/drawings/
/collection/sketches/
/subjects/{slug}/
/constellations/{slug}/
/themes/{slug}/

With the controlled data living centrally rather than being recreated in every artwork record:

_data/
    artwork-taxonomy.json
    artwork-ontology.json

Artwork records would then use structured Markdown front matter or JSON/YAML, while Eleventy generated the browse surfaces from those canonical values.

The implementation work subsequently included a canonical artwork schema, catalog records, provenance, uniqueness rules for taxonomy/relationship keys, artwork detail pages, archive pages, taxonomy browse pages, constellation pages, and a curated collection landing page.

The model in one line

If I compress the whole thing, Lucid Vagary had evolved from a gallery organized by folders into a small knowledge graph for visual imagination:

Asset → Artwork → Subject → Motif → Theme → Constellation ↔ Related Artwork

And I think that final arrow—Constellation ↔ Related Artwork—is where it became distinctively yours rather than another conventional portfolio taxonomy. It lets a work acquire different meanings depending on the symbolic company in which it is placed.
