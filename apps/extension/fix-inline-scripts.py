#!/usr/bin/env python3
"""
Post-process Next.js static export for Chrome Extension compatibility.
Extracts inline <script> tags into external .js files to comply with MV3 CSP.
Uses Python's html.parser instead of regex to avoid CodeQL bad-tag-filter alerts.
"""

import sys
from pathlib import Path
from html.parser import HTMLParser


class ScriptExtractor(HTMLParser):
    """Parse HTML and extract inline scripts into external .js files."""

    def __init__(self, output_dir: Path, basename: str):
        super().__init__()
        self.output_dir = output_dir
        self.basename = basename
        self.counter = 0
        self.result_parts: list[str] = []
        self._in_script = False
        self._script_has_src = False
        self._script_content = ""
        self._script_tag_raw = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        if tag == "script":
            self._in_script = True
            self._script_has_src = any(a[0] == "src" for a in attrs)
            self._script_content = ""
            # Reconstruct the opening tag
            attr_str = ""
            for name, value in attrs:
                if value is None:
                    attr_str += f" {name}"
                else:
                    attr_str += f' {name}="{value}"'
            self._script_tag_raw = f"<script{attr_str}>"
        else:
            attr_str = ""
            for name, value in attrs:
                if value is None:
                    attr_str += f" {name}"
                else:
                    attr_str += f' {name}="{value}"'
            self.result_parts.append(f"<{tag}{attr_str}>")

    def handle_endtag(self, tag: str):
        if tag == "script" and self._in_script:
            self._in_script = False
            if self._script_has_src or not self._script_content.strip():
                # Keep external or empty scripts as-is
                self.result_parts.append(self._script_tag_raw)
                self.result_parts.append(self._script_content)
                self.result_parts.append("</script>")
            else:
                # Extract inline script to external file
                js_filename = f"_inline_{self.basename}_{self.counter}.js"
                js_path = self.output_dir / js_filename
                js_path.write_text(self._script_content, encoding="utf-8")
                self.counter += 1
                self.result_parts.append(f'<script src="./{js_filename}"></script>')
        else:
            self.result_parts.append(f"</{tag}>")

    def handle_data(self, data: str):
        if self._in_script:
            self._script_content += data
        else:
            self.result_parts.append(data)

    def handle_comment(self, data: str):
        self.result_parts.append(f"<!--{data}-->")

    def handle_decl(self, decl: str):
        self.result_parts.append(f"<!{decl}>")

    def get_result(self) -> str:
        return "".join(self.result_parts)


def process_html_file(html_path: Path):
    """Extract inline scripts from an HTML file into external JS files."""
    content = html_path.read_text(encoding="utf-8")
    output_dir = html_path.parent
    basename = html_path.stem

    parser = ScriptExtractor(output_dir, basename)
    parser.feed(content)

    html_path.write_text(parser.get_result(), encoding="utf-8")
    print(f"  Extracted {parser.counter} inline scripts from {html_path.name}")


def main():
    if len(sys.argv) < 2:
        print("Usage: fix-inline-scripts.py <directory>")
        sys.exit(1)

    target_dir = Path(sys.argv[1])
    if not target_dir.is_dir():
        print(f"Error: {target_dir} is not a directory")
        sys.exit(1)

    # Process all HTML files
    html_files = list(target_dir.glob("**/*.html"))
    print(f"Processing {len(html_files)} HTML files...")

    for html_file in html_files:
        process_html_file(html_file)

    print("Done!")


if __name__ == "__main__":
    main()
