#!/bin/sh
# Convert PDFs to Markdown with MarkItDown, writing <name>.md next to each PDF.
#   scripts/pdf-to-md.sh ../pdfs/document.pdf [more.pdf ...]
# Needs markitdown on PATH: pipx install 'markitdown[pdf]'
set -eu

if ! command -v markitdown >/dev/null 2>&1; then
  echo "markitdown not found: pipx install 'markitdown[pdf]'" >&2
  exit 1
fi
if [ $# -eq 0 ]; then
  echo "usage: $0 file.pdf [file.pdf ...]" >&2
  exit 1
fi

for pdf in "$@"; do
  out="${pdf%.*}.md"
  markitdown "$pdf" -o "$out"
  echo "$out"
done
