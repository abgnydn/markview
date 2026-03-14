# MarkView MCP Server

Expose your local markdown documentation to AI assistants via the [Model Context Protocol](https://modelcontextprotocol.io).

## Quick Start

```bash
# Point at any directory containing .md files
npx tsx apps/mcp/src/index.ts ./docs
```

## 15 Tools

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

### Workspace Health
| Tool | Description |
|------|-------------|
| `validate_workspace` | Full health check: broken links, orphans, missing titles, empty docs |
| `get_stats` | Total words, reading time, languages, link density, tables |

### Write & Manage
| Tool | Description |
|------|-------------|
| `create_document` | Create a new `.md` file (with auto-directory creation) |
| `update_document` | Edit: replace, append, prepend, or find-and-replace |
| `rename_document` | Move a file and auto-update all internal links |

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

### Build

```bash
cd apps/mcp
npm run build
```

## Example Prompts

> "Search my docs for anything about authentication"
> "What's the table of contents for api.md?"
> "Are there any broken links in my documentation?"
> "Extract all Python code examples from the tutorial"
> "Find docs related to the auth spec"
> "What terms are defined in my glossary?"
> "Add a new document at api/webhooks.md with..."
> "Rename setup.md to getting-started.md and update all links"
