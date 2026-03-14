#!/usr/bin/env python3
"""
Post-process Next.js static export for Chrome Extension compatibility.
Extracts inline <script> tags into external .js files to comply with MV3 CSP.
"""

import re
import sys
import os
from pathlib import Path


def process_html_file(html_path: Path):
    """Extract inline scripts from an HTML file into external JS files."""
    content = html_path.read_text(encoding='utf-8')
    output_dir = html_path.parent
    basename = html_path.stem

    counter = 0

    def replace_inline_script(match):
        nonlocal counter
        script_content = match.group(1)

        # Skip empty scripts
        if not script_content.strip():
            return match.group(0)

        # Write to external file
        js_filename = f'_inline_{basename}_{counter}.js'
        js_path = output_dir / js_filename
        js_path.write_text(script_content, encoding='utf-8')
        counter += 1

        return f'<script src="./{js_filename}"></script>'

    # Replace inline scripts (but not ones that already have src)
    new_content = re.sub(
        r'<script>(.*?)</script>',
        replace_inline_script,
        content,
        flags=re.DOTALL,
    )

    html_path.write_text(new_content, encoding='utf-8')
    print(f'  Extracted {counter} inline scripts from {html_path.name}')


def main():
    if len(sys.argv) < 2:
        print('Usage: fix-inline-scripts.py <directory>')
        sys.exit(1)

    target_dir = Path(sys.argv[1])
    if not target_dir.is_dir():
        print(f'Error: {target_dir} is not a directory')
        sys.exit(1)

    # Process all HTML files
    html_files = list(target_dir.glob('**/*.html'))
    print(f'Processing {len(html_files)} HTML files...')

    for html_file in html_files:
        process_html_file(html_file)

    print('Done!')


if __name__ == '__main__':
    main()
