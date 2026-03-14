# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅        |

## Reporting a Vulnerability

If you discover a security vulnerability in MarkView, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. **Email** [abgunaydin94@gmail.com](mailto:abgunaydin94@gmail.com) with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive a response within **48 hours**
4. A fix will be released as soon as possible, and you will be credited (unless you prefer anonymity)

## Security Model

MarkView is designed with a privacy-first architecture:

- **Web App**: All file processing happens client-side in the browser. Files are stored in IndexedDB and never sent to any server. Markdown HTML is sanitized via `rehype-sanitize` to prevent XSS.
- **MCP Server**: Runs locally on the user's machine. File operations are sandboxed to the workspace directory via path traversal validation.
- **Chrome Extension**: Uses Manifest V3 with minimal permissions (`sidePanel`, `contextMenus`, `activeTab`, `storage`) and a strict Content Security Policy.
- **GitHub Import**: Fetches only from `raw.githubusercontent.com` and `api.github.com`. URL segments are validated against a safe character allowlist.

## Security Measures

- HTML sanitization strips `<script>`, `<iframe>`, `<style>`, event handlers, and other dangerous elements
- MCP write operations validate that file paths resolve within the workspace directory
- GitHub import validates owner/repo names contain only alphanumeric characters, hyphens, dots, and underscores
- No server-side processing — no attack surface for server-side vulnerabilities
- No authentication — no credentials to leak
- No telemetry — no data collection to compromise
