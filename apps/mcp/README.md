# MarkView MCP Server

Expose your local markdown documentation to AI assistants via the [Model Context Protocol](https://modelcontextprotocol.io).

## Quick Start

```bash
# Point at any directory containing .md files
npx tsx apps/mcp/src/index.ts ./docs
```

## 23 Tools

### Read & Analyze
| Tool | Description |
|------|-------------|
| `list_documents` | List all `.md` files with word count, reading time, heading count |
| `get_document` | Read a specific document's content + optional metadata |
| `search_docs` | Full-text search across all documents with context lines |
| `get_headings` | Get heading structure (TOC) for a file or entire workspace |
| `get_links` | Extract links, validate internal `.md` references |
| `get_code_blocks` | Extract code blocks with language identifiers |
| `get_frontmatter` | Parse YAML frontmatter metadata from documents |
| `get_tables` | Extract tables as structured JSON (headers + rows) |
| `get_related_docs` | Find related documents by shared links/headings/content |
| `get_glossary` | Extract key terms and definitions |
| `get_mermaid_diagrams` | Extract Mermaid diagrams with type detection (flowchart, sequence, gantt, etc.) |
| `get_math_blocks` | Extract KaTeX/LaTeX math expressions (inline + display) |
| `analyze_reading_level` | Flesch-Kincaid readability scoring per document or workspace |

### Workspace Health
| Tool | Description |
|------|-------------|
| `validate_workspace` | Full health check: broken links, orphans, missing titles, empty docs |
| `get_stats` | Total words, reading time, languages, link density, tables |
| `generate_toc` | Generate or insert table of contents from headings |

### Write & Manage
| Tool | Description |
|------|-------------|
| `create_document` | Create a new `.md` file (with auto-directory creation) |
| `update_document` | Edit: replace, append, prepend, or find-and-replace |
| `rename_document` | Move a file and auto-update all internal links |
| `delete_document` | Delete a document (with path traversal protection) |
| `merge_documents` | Combine multiple documents into one |

### Share & Export
| Tool | Description |
|------|-------------|
| `share_document` | Generate a `markview.ai` share URL (gzip + base64url, no server needed) |
| `render_document` | Export to standalone HTML with Mermaid, KaTeX, and syntax highlighting |

## MCP Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Workspace Overview | `markview://workspace/overview` | File count, total words, languages, reading time |

## MCP Prompts

| Prompt | Description |
|--------|-------------|
| `review-docs` | Full quality audit: broken links, readability, structure |
| `summarize-workspace` | Executive summary of all documentation |
| `generate-api-docs` | Generate API docs from existing code blocks and patterns |

## Connect to AI Clients

### Claude Desktop / Cursor / Windsurf

Add to your MCP config (`~/.cursor/mcp.json`, etc.):

```json
{
  "mcpServers": {
    "markview": {
      "command": "node",
      "args": ["/absolute/path/to/markview/apps/mcp/dist/index.js", "/path/to/your/docs"]
    }
  }
}
```

### WebRTC P2P Mode (Experimental)

Connect cloud AI agents to your local files over an encrypted peer-to-peer WebRTC tunnel. Zero uploads, zero cloud storage.

```bash
# Terminal 1: Start the signaling relay
npx tsx apps/mcp/scripts/signaling-server.ts

# Terminal 2: Start the MCP server in WebRTC mode
npx tsx apps/mcp/src/index.ts ./docs --webrtc --room my-room
```

Any WebRTC client (browser, Chrome Extension, or another Node.js process) can now connect to `my-room` via the signaling server and invoke all 23 tools over a P2P Data Channel.

**Architecture:**
```
┌─────────────────┐       WebSocket        ┌─────────────────┐
│   MCP Server    │◄── Signaling Relay ──►│    AI Agent      │
│ (your laptop)   │       (broker)        │ (cloud/browser)  │
└───────┬─────────┘                       └───────┬──────────┘
        │                                         │
        └───── WebRTC Data Channel (P2P) ─────────┘
                  (MCP JSON-RPC messages)
```

See [PROTOCOL.md](./PROTOCOL.md) for the full specification.

### Build

```bash
cd apps/mcp
npm run build
```

## Example Prompts

> "Search my docs for anything about authentication"
> "What's the table of contents for api.md?"
> "Are there any broken links in my documentation?"
> "Extract all Mermaid diagrams from my workspace"
> "Generate a share link for my README"
> "Render my API docs as an HTML file"
> "What's the reading level of my documentation?"
> "Merge the setup and config docs into one guide"
> "Find docs related to the auth spec"
> "Add a new document at api/webhooks.md with..."
