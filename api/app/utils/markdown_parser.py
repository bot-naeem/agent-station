import frontmatter
import re
from typing import Any


def parse_markdown(content: str) -> dict[str, Any]:
    """解析 markdown，提取 front matter 和内容"""
    try:
        post = frontmatter.loads(content)
        front_matter = dict(post.metadata)
        content_without_fm = post.content
    except Exception:
        front_matter = {}
        content_without_fm = content

    # 提取标题 (第一个 # 标题)
    title_match = re.search(r"^#\s+(.+)$", content_without_fm, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else None

    # 提取摘要 (第一段非空文本，限制 200 字)
    paragraphs = [p.strip() for p in content_without_fm.split("\n\n") if p.strip() and not p.strip().startswith("#")]
    summary = paragraphs[0][:200] if paragraphs else None

    return {
        "front_matter": front_matter,
        "content": content_without_fm,
        "title": title,
        "summary": summary,
    }