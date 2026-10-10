"""Prepare an EMPTY LittleFS image for first commissioning only; pio uploadfs erases queue."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=root/'firmware/data'
data.mkdir(exist_ok=True)
(data/'README.txt').write_text('Initial empty event storage. Upload this only to a NEW device.\n')
print('Ready. On a NEW device: python -m platformio run -d firmware -e feather -t uploadfs')
