# MarkerDown

A hierarchical markdown-based knowledge management system for students. View, organize, and manage multi-fidelity versions of information as unified entities.

## The Problem

University students face information fragmentation:
- Same content exists across formats (PDF, notes, summaries)
- Multiple fidelity levels (raw → dense → condensed) create file sprawl
- Flat folder structures lose conceptual hierarchy
- Old notes become inaccessible clutter
- Manual extraction from PDFs is tedious

## The Solution

MarkerDown treats **multiple versions of information as a single entity** and uses a **hierarchical markdown structure** that maps directly to your filesystem.

### Entity Model

```
[Entity: "Percentages"]
├── Raw: percentages-textbook.pdf
├── Dense: percentages-full.md
└── Condensed: percentages-keypoints.md
```

Three files, one logical entity.

### Hierarchical Structure (Sidecar Convention)

```
math/
├── percentages.md           ← Parent content
├── percentages/             ← Children folder (same name, no .md)
│   ├── simple-interest.md
│   └── compound-interest.md
├── algebra.md
└── algebra/
    ├── quadratics.md
    └── linear.md
```

A markdown file can be both **content** and a **container** for children.

## Features

### MVP (Phase 1)
- Hierarchical markdown viewer
- Sidecar folder convention for parent-child relationships
- Tree navigation that mirrors Explorer structure
- Markdown rendering with syntax highlighting

### Planned
- **Entity linking**: Group raw/dense/condensed as one entity via frontmatter
- **AI summarization**: PDF → Dense → Condensed via Claude CLI
- **RAG assistant**: Query across all knowledge ("What deadlines do I have?")
- **Smart parsing**: Unstructured notes + images → structured markdown
- **Archive system**: Hide old content while keeping it searchable
- **Consistency checker**: Propagate edits across entity versions

## Tech Stack

- **Runtime**: Electron
- **UI**: React + TypeScript
- **Markdown**: remark/rehype ecosystem
- **File watching**: chokidar
- **Styling**: TBD (Tailwind or CSS Modules)

## Development

```bash
# Install dependencies
yarn install

# Run in development
yarn dev

# Build for production
yarn build
```

## Project Structure

```
markerdown/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React UI
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   └── shared/         # Shared types and utilities
├── agents/             # Claude agent configuration
└── package.json
```

## License

MIT
