'use client';

export interface WorkspaceTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  files: { filename: string; content: string }[];
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: 'readme',
    name: 'README',
    emoji: '📖',
    description: 'Project README with badges, installation, and usage',
    files: [
      {
        filename: 'README.md',
        content: `# Project Name

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

A brief description of what this project does and who it's for.

## Features

- ✅ Feature one
- ✅ Feature two
- 🚧 Feature three (coming soon)

## Installation

\`\`\`bash
npm install your-package
\`\`\`

## Usage

\`\`\`javascript
import { something } from 'your-package';

const result = something();
console.log(result);
\`\`\`

## API Reference

### \`functionName(param)\`

| Parameter | Type     | Description                |
|-----------|----------|----------------------------|
| \`param\`   | \`string\` | **Required**. Your parameter |

Returns: \`Promise<Result>\`

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

## License

[MIT](https://choosealicense.com/licenses/mit/)
`,
      },
    ],
  },
  {
    id: 'api-docs',
    name: 'API Documentation',
    emoji: '🔌',
    description: 'REST API docs with endpoints, auth, and examples',
    files: [
      {
        filename: 'api-reference.md',
        content: `# API Reference

Base URL: \`https://api.example.com/v1\`

## Authentication

All API requests require a Bearer token in the Authorization header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Endpoints

### Get All Items

\`\`\`http
GET /items
\`\`\`

| Query Parameter | Type     | Description              |
|-----------------|----------|--------------------------|
| \`page\`          | \`number\` | Page number (default: 1) |
| \`limit\`         | \`number\` | Items per page (max: 100)|

**Response** \`200 OK\`

\`\`\`json
{
  "data": [
    { "id": 1, "name": "Item 1", "status": "active" }
  ],
  "meta": { "page": 1, "total": 42 }
}
\`\`\`

### Create Item

\`\`\`http
POST /items
\`\`\`

| Body Field | Type     | Description          |
|------------|----------|----------------------|
| \`name\`     | \`string\` | **Required**. Name   |
| \`status\`   | \`string\` | "active" or "draft"  |

**Response** \`201 Created\`

### Error Codes

| Code | Description           |
|------|-----------------------|
| 400  | Bad Request           |
| 401  | Unauthorized          |
| 404  | Not Found             |
| 429  | Rate Limit Exceeded   |
| 500  | Internal Server Error |

## Rate Limiting

- **100 requests** per minute per API key
- Headers: \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`
`,
      },
    ],
  },
  {
    id: 'changelog',
    name: 'Changelog',
    emoji: '📋',
    description: 'Keep a changelog with versioned release notes',
    files: [
      {
        filename: 'CHANGELOG.md',
        content: `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- New feature description

### Changed
- Updated behavior description

## [1.1.0] - 2025-01-15

### Added
- Dark mode support
- Export to PDF functionality
- Keyboard shortcuts for common actions

### Fixed
- Fixed rendering issue with nested lists
- Corrected table alignment on mobile

## [1.0.0] - 2025-01-01

### Added
- Initial release
- Markdown rendering with syntax highlighting
- File upload and workspace management
- Live preview in split-pane editor
`,
      },
    ],
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    emoji: '📝',
    description: 'Structured meeting notes with agenda and action items',
    files: [
      {
        filename: 'meeting-notes.md',
        content: `# Meeting Notes — [Date]

**Attendees:** @person1, @person2, @person3
**Duration:** 30 min
**Meeting Type:** Weekly Standup

---

## Agenda

1. Progress updates
2. Blockers & dependencies
3. Next steps

## Discussion

### Topic 1: [Title]

- Key point discussed
- Decision made: **[decision]**

### Topic 2: [Title]

- Key point discussed
- Open question: *[question]*

## Action Items

- [ ] @person1 — Task description (due: Friday)
- [ ] @person2 — Task description (due: next week)
- [ ] @person3 — Task description (due: EOD)

## Next Meeting

- **Date:** [Next date]
- **Agenda items to carry over:**
  - Item from this meeting
`,
      },
    ],
  },
  {
    id: 'technical-spec',
    name: 'Technical Spec',
    emoji: '⚙️',
    description: 'RFC-style technical design document',
    files: [
      {
        filename: 'technical-spec.md',
        content: `# Technical Specification: [Feature Name]

**Author:** Your Name
**Status:** Draft
**Created:** [Date]

## Summary

A brief one-paragraph description of the proposed change.

## Motivation

Why are we doing this? What problem does it solve?

## Detailed Design

### Architecture

\`\`\`mermaid
flowchart TD
    A[Client] --> B[API Gateway]
    B --> C[Service A]
    B --> D[Service B]
    C --> E[(Database)]
\`\`\`

### Data Model

| Field       | Type       | Description          |
|-------------|------------|----------------------|
| \`id\`        | \`uuid\`     | Primary key          |
| \`name\`      | \`string\`   | Display name         |
| \`created_at\`| \`datetime\` | Creation timestamp   |

### API Changes

\`\`\`http
POST /api/v2/feature
Content-Type: application/json

{
  "name": "example",
  "config": {}
}
\`\`\`

## Alternatives Considered

1. **Alternative A** — Pros and cons
2. **Alternative B** — Pros and cons

## Risks & Mitigations

| Risk                    | Mitigation              |
|-------------------------|-------------------------|
| Performance degradation | Add caching layer       |
| Breaking changes        | Version the API         |

## Rollout Plan

1. Phase 1: Internal testing (1 week)
2. Phase 2: Beta users (2 weeks)
3. Phase 3: General availability
`,
      },
    ],
  },
  {
    id: 'blog-post',
    name: 'Blog Post',
    emoji: '✍️',
    description: 'Blog post with frontmatter, sections, and CTA',
    files: [
      {
        filename: 'blog-post.md',
        content: `---
title: "Your Blog Post Title"
author: "Your Name"
date: "${new Date().toISOString().split('T')[0]}"
tags: [engineering, tutorial]
---

# Your Blog Post Title

*A compelling subtitle that hooks the reader.*

## Introduction

Start with a hook. Why should the reader care about this topic? Set the scene and establish the problem you're solving.

## The Problem

Describe the challenge or pain point in detail. Use real-world examples.

> "A relevant quote that supports your point." — Someone Notable

## The Solution

Walk through your approach step by step.

### Step 1: Setup

\`\`\`bash
npm install amazing-tool
\`\`\`

### Step 2: Implementation

\`\`\`javascript
// Your code example
const solution = buildSomethingGreat();
\`\`\`

### Step 3: Results

Share the outcomes — metrics, before/after comparisons, or user feedback.

## Key Takeaways

- **Takeaway 1** — Brief explanation
- **Takeaway 2** — Brief explanation
- **Takeaway 3** — Brief explanation

## Conclusion

Summarize what you covered and provide a clear call-to-action.

---

*Have questions? Reach out on [Twitter](https://twitter.com) or [GitHub](https://github.com).*
`,
      },
    ],
  },
];
