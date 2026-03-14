# Contributing to MarkView

First off, thank you for considering contributing to MarkView! 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

MarkView is a monorepo with three apps:

| App | Path | Description |
|-----|------|-------------|
| **Web** | `apps/web` | Next.js documentation viewer (main app) |
| **MCP** | `apps/mcp` | Model Context Protocol server (15 tools) |
| **Extension** | `apps/extension` | Chrome extension for viewing .md files |

## Development Setup

### Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **npm** 9+

### Web App

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### MCP Server

```bash
cd apps/mcp
npm install
npm run build
```

Test a tool:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_stats","arguments":{}}}' | node dist/index.js ./your-docs
```

### Chrome Extension

```bash
cd apps/extension
```

Load as an unpacked extension in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `apps/extension` directory

## Project Structure

```
markview/
├── apps/
│   ├── web/                 # Next.js web app
│   │   ├── src/
│   │   │   ├── app/         # Pages and global styles
│   │   │   ├── components/  # React components
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── lib/         # Utility libraries (markdown pipeline, etc.)
│   │   │   └── stores/      # Zustand state stores
│   │   └── public/          # Static assets
│   ├── mcp/                 # MCP server
│   │   └── src/index.ts     # All 15 MCP tools
│   └── extension/           # Chrome extension
├── LICENSE
├── README.md
└── CONTRIBUTING.md
```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feat/add-mermaid-themes` — new features
- `fix/search-highlight-bug` — bug fixes
- `docs/update-readme` — documentation
- `refactor/split-renderer` — code refactoring

### Code Style

- **TypeScript** for all new code
- Use functional React components with hooks
- CSS follows the existing class naming convention (`.component-element` pattern)
- Keep components focused — one concern per file

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(web): add table sorting in rendered tables
fix(mcp): handle empty files in get_stats tool
docs: update README with new MCP tools
```

## Submitting a Pull Request

1. **Fork** the repository
2. **Create** a feature branch from `main`
3. **Make** your changes with clear, focused commits
4. **Test** your changes locally
5. **Push** your branch and open a PR against `main`

### PR Guidelines

- Keep PRs focused — one feature or fix per PR
- Include screenshots for UI changes
- Update documentation if adding new features
- Add a clear description of what changed and why

## Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS information
- Screenshots if applicable

## Suggesting Features

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md) and describe:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

---

Thank you for making MarkView better! 💜
