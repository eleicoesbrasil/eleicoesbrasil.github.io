"""Decodificador BER genérico mínimo (tag, valor); constructed -> lista de filhos."""


def _len(b: bytes, i: int):
    n = b[i]; i += 1
    if n < 0x80:
        return n, i
    k = n & 0x7F
    return int.from_bytes(b[i:i + k], "big"), i + k


def parse(b: bytes, i: int = 0, end: int | None = None):
    end = len(b) if end is None else end
    out = []
    while i < end:
        t0 = b[i]; i += 1
        cls, cons, tag = t0 >> 6, bool(t0 & 0x20), t0 & 0x1F
        if tag == 0x1F:
            tag = 0
            while True:
                x = b[i]; i += 1
                tag = (tag << 7) | (x & 0x7F)
                if not x & 0x80:
                    break
        n, i = _len(b, i)
        v = parse(b, i, i + n) if cons else b[i:i + n]
        out.append((cls, tag, v))
        i += n
    return out


def to_int(v: bytes) -> int:
    return int.from_bytes(v, "big", signed=True)


def dump(nodes, depth=0, maxd=12):
    for cls, tag, v in nodes:
        pre = "  " * depth + f"[{cls}:{tag}]"
        if isinstance(v, list):
            print(pre)
            if depth < maxd:
                dump(v, depth + 1, maxd)
        else:
            s = v.decode("latin-1") if v and all(32 <= c < 127 for c in v) else v.hex()
            print(pre, s[:80], f"(int={to_int(v)})" if 0 < len(v) <= 4 else "")
