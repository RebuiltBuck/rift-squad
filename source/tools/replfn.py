# replace a top-level JS function (from "function NAME(" up to the next top-level "function " / "// ----------" / "async function") with new text
import re, sys
def replace_fn(src, name, new):
    m = re.search(r'^(async )?function ' + re.escape(name) + r'\(', src, re.M)
    assert m, name
    start = m.start()
    nxt = re.compile(r'^(async function |function |// ----------|let |const )', re.M)
    m2 = nxt.search(src, m.end())
    end = m2.start() if m2 else len(src)
    return src[:start] + new.rstrip() + '\n' + src[end:]
