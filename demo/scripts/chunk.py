#!/usr/bin/env python3
"""
Chunker for the demo RAG ingest pipeline.

Reads a knowledge text file (clinic notes are loosely formatted: bullet lists
with bare-line section headers, no markdown `#` syntax), splits it into
~500-character chunks that preserve their section heading as context, and
writes each chunk as its own .txt file under demo/chunks/. Downstream the
ingest step (see demo/scripts/seed-knowledge.ts) embeds each chunk and inserts
into the `knowledge_chunks` table.

Strategy
--------
1. Detect section headings: column-0 lines that aren't bullets, aren't outline
   numbered items, are <= 80 chars, and don't look like sentence/label lines
   (don't end in `.` or `:`, don't start with `Word:`).
2. Group the body lines under each heading.
3. For each section:
     - If <= TARGET + slack: emit as one chunk, prefixed with the heading.
     - Otherwise: split greedily on top-level bullets, pack items into
       TARGET-sized chunks, prefix every resulting chunk with the heading so
       the embedding sees section context.
4. Drop a leading numbered table-of-contents block if present (every non-blank
   line is `N. ...`).

Usage
-----
    python3 demo/scripts/chunk.py [INPUT] [--out DIR] [--target N]

INPUT defaults to demo/data/sample_clinic_knowledge. If INPUT is a directory,
every regular file inside it is chunked.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

TARGET = 500
SLACK = 200  # tolerate up to TARGET + SLACK before forcing a split

BULLET_RE = re.compile(r"^[*\-•]\s")
NUMBERED_TOC_RE = re.compile(r"^\s*\d+\.\s")
LABEL_PREFIX_RE = re.compile(r"^[A-Za-z]+\s*:")
ANY_BULLET_RE = re.compile(r"^(\s*)[*\-•]\s")


def is_heading(line: str) -> bool:
    if not line or line[0] in (" ", "\t"):
        return False
    s = line.rstrip()
    if not s or len(s) > 80:
        return False
    if BULLET_RE.match(line) or NUMBERED_TOC_RE.match(line):
        return False
    if s.endswith((".", ":")):
        return False
    if LABEL_PREFIX_RE.match(s):
        return False
    return True


def parse_sections(text: str) -> list[tuple[str, str]]:
    """Return [(heading, body), ...]. Pre-heading content gets heading=''."""
    lines = text.splitlines()
    sections: list[tuple[str, list[str]]] = []
    heading = ""
    body: list[str] = []

    for line in lines:
        if is_heading(line):
            if heading or body:
                sections.append((heading, body))
            heading = line.strip()
            body = []
        else:
            body.append(line)

    if heading or body:
        sections.append((heading, body))

    out: list[tuple[str, str]] = []
    for h, b in sections:
        joined = "\n".join(b).strip("\n")
        joined = re.sub(r"\n{3,}", "\n\n", joined)
        out.append((h, joined))
    return out


def drop_leading_toc(sections: list[tuple[str, str]]) -> list[tuple[str, str]]:
    if not sections or sections[0][0] != "":
        return sections
    body = sections[0][1]
    non_blank = [ln for ln in body.split("\n") if ln.strip()]
    if not non_blank:
        return sections[1:]
    if all(NUMBERED_TOC_RE.match(ln) for ln in non_blank):
        return sections[1:]
    return sections


def split_items_at_indent(lines: list[str], indent: int) -> list[list[str]]:
    """Group lines into items, starting a new item on each bullet at `indent`."""
    bullet_at = re.compile(r"^" + (" " * indent) + r"[*\-•]\s")
    items: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        if bullet_at.match(line):
            if current:
                items.append(current)
            current = [line]
        else:
            current.append(line)
    if current:
        items.append(current)
    return items


def split_oversized_item(item_lines: list[str]) -> list[list[str]]:
    """Recursively split an item that exceeds TARGET+SLACK on its own nested level.

    The first line is treated as the item's "parent" bullet; it is replicated
    onto each resulting sub-item so context survives the split.
    """
    if not item_lines:
        return [item_lines]
    if sum(len(ln) + 1 for ln in item_lines) <= TARGET + SLACK:
        return [item_lines]

    parent, children = item_lines[0], item_lines[1:]
    child_indents = sorted(
        {len(m.group(1)) for ln in children if (m := ANY_BULLET_RE.match(ln))}
    )
    if not child_indents:
        return [item_lines]  # nothing nested to split on

    next_indent = child_indents[0]
    sub_items = split_items_at_indent(children, next_indent)
    if len(sub_items) <= 1:
        return [item_lines]

    out: list[list[str]] = []
    for sub in sub_items:
        out.extend(split_oversized_item([parent] + sub))
    return out


def split_long_body(heading: str, body: str) -> list[str]:
    """Split a long body into TARGET-sized chunks, each prefixed with heading."""
    lines = body.split("\n")

    items = split_items_at_indent(lines, indent=0)
    if len(items) <= 1:
        paras = [p for p in re.split(r"\n\s*\n", body) if p.strip()]
        items = [[p] for p in paras]

    # Recursively split any item that exceeds TARGET+SLACK on its own.
    expanded: list[list[str]] = []
    for item in items:
        expanded.extend(split_oversized_item(item))

    prefix = f"{heading}\n" if heading else ""
    chunks: list[str] = []
    buf: list[str] = []
    buf_len = len(prefix)

    def flush() -> None:
        nonlocal buf, buf_len
        if buf:
            chunks.append((prefix + "\n".join(buf)).strip())
            buf = []
            buf_len = len(prefix)

    for item in expanded:
        text = "\n".join(item).strip("\n")
        if not text:
            continue
        add_len = len(text) + (1 if buf else 0)
        if buf and buf_len + add_len > TARGET + SLACK:
            flush()
            add_len = len(text)
        buf.append(text)
        buf_len += add_len

    flush()
    return chunks


def chunks_for_section(heading: str, body: str) -> list[str]:
    body = body.strip()
    if not body and not heading:
        return []

    if heading and body:
        full = f"{heading}\n{body}"
    else:
        full = heading or body

    if len(full) <= TARGET + SLACK:
        return [full.strip()]

    return split_long_body(heading, body)


def chunk_file(path: Path, out_dir: Path) -> int:
    text = path.read_text(encoding="utf-8")
    sections = drop_leading_toc(parse_sections(text))

    stem = path.stem or "doc"
    idx = 0
    for heading, body in sections:
        for chunk in chunks_for_section(heading, body):
            if not chunk.strip():
                continue
            out_path = out_dir / f"{stem}__{idx:04d}.txt"
            out_path.write_text(chunk + "\n", encoding="utf-8")
            idx += 1
    return idx


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "input",
        nargs="?",
        default="demo/data/sample_clinic_knowledge",
        help="Input file or directory (default: demo/data/sample_clinic_knowledge)",
    )
    parser.add_argument(
        "--out",
        default="demo/chunks",
        help="Output directory (default: demo/chunks)",
    )
    parser.add_argument(
        "--keep",
        action="store_true",
        help="Do not clear existing .txt files in --out before writing",
    )
    args = parser.parse_args()

    in_path = Path(args.input)
    out_dir = Path(args.out)

    if not in_path.exists():
        print(f"error: input not found: {in_path}", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    if not args.keep:
        for f in out_dir.glob("*.txt"):
            f.unlink()

    inputs = (
        [in_path] if in_path.is_file() else sorted(p for p in in_path.iterdir() if p.is_file())
    )

    total = 0
    for inp in inputs:
        n = chunk_file(inp, out_dir)
        total += n
        print(f"  {inp.name}: {n} chunk(s)")

    print(f"Wrote {total} chunk(s) to {out_dir}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
