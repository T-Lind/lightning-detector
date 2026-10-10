"""Check authored Markdown links without crawling network or vendor README files."""
import re
from pathlib import Path
from urllib.parse import unquote
root=Path(__file__).resolve().parents[1]
files=list(root.glob('*.md'))+list((root/'docs').rglob('*.md'))
files += [root/'hardware/BOM.md',root/'hardware/LICENSE.md',root/'hardware/3d/README.md',root/'hardware/reference/README.md']
count=0
for p in files:
    for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',p.read_text(encoding='utf-8')):
        if re.match(r'^[a-z]+://',target) or target.startswith('#'): continue
        dest=unquote(target.split('#',1)[0].strip('<>'))
        assert (p.parent/dest).exists(), f'{p.relative_to(root)} -> missing {dest}'
        count+=1
print(f'PASS: {count} relative links in {len(files)} authored Markdown files.')
