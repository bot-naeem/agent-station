import tiktoken
from typing import Optional


def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
    encoding: Optional[tiktoken.Encoding] = None,
) -> list[str]:
    """将文本按 token 切分"""
    if encoding is None:
        encoding = tiktoken.get_encoding("cl100k_base")

    tokens = encoding.encode(text)
    if len(tokens) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunk_text = encoding.decode(chunk_tokens)
        chunks.append(chunk_text)

        if end >= len(tokens):
            break
        start = end - chunk_overlap

    return chunks


def count_tokens(text: str, encoding: Optional[tiktoken.Encoding] = None) -> int:
    """计算 token 数量"""
    if encoding is None:
        encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))