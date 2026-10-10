"""Download the expected manufacturer's enclosure STEP for LOCAL inspection only."""
import hashlib, io, zipfile
from pathlib import Path
from urllib.request import Request, urlopen

URL='https://www.hammfg.com/files/parts/stp/1554R2GY.zip?v=1697661989'
EXPECTED='0a76b6e0dfd3a17be9c708cce506b23e05e4c26774b27b77eef0a26cd76a58fa'
OUT=Path(__file__).resolve().parents[1]/'hardware/3d/source/1554R.stp'

def main():
    if OUT.exists():
        if hashlib.sha256(OUT.read_bytes()).hexdigest()!=EXPECTED:
            raise RuntimeError('Existing enclosure STEP differs; review it before continuing.')
        print('Expected enclosure source already present locally.'); return
    request=Request(URL,headers={'User-Agent':'lightning-detector-local-reference/1'})
    with urlopen(request,timeout=45) as response:
        data=response.read(20*1024*1024+1)
    if len(data)>20*1024*1024: raise RuntimeError('Unexpectedly large enclosure archive')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        matches=[n for n in archive.namelist() if Path(n).name.lower()=='1554r.stp']
        if len(matches)!=1: raise RuntimeError('Expected STEP entry is missing or ambiguous')
        info=archive.getinfo(matches[0])
        if info.file_size>30*1024*1024: raise RuntimeError('Unexpectedly large STEP')
        content=archive.read(matches[0])
    if hashlib.sha256(content).hexdigest()!=EXPECTED:
        raise RuntimeError('Manufacturer reference changed. Review revision and fit before updating the pinned hash.')
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_bytes(content)
    print('Downloaded verified enclosure source for local use. Manufacturer terms still apply; do not add it to Git.')

if __name__=='__main__': main()
