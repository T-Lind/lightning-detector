"""Capture Feather boot/runtime logs without leaving COM port locked."""
import argparse
import time
import sys
from pathlib import Path
import serial

parser = argparse.ArgumentParser()
parser.add_argument('--port', required=True)
parser.add_argument('--seconds', type=float, default=30)
parser.add_argument('--reset', action='store_true')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
args.output.parent.mkdir(parents=True, exist_ok=True)
with serial.Serial() as port:
    port.port = args.port
    port.baudrate = 115200
    port.timeout = 0.2
    port.dtr = False
    port.rts = False
    port.open()
    if args.reset:
        port.rts = True
        time.sleep(0.1)
        port.rts = False
    start = time.monotonic()
    pending = b''
    with args.output.open('w', encoding='utf-8') as log:
        while time.monotonic() - start < args.seconds:
            pending += port.read(max(1, port.in_waiting))
            while b'\n' in pending:
                line, pending = pending.split(b'\n', 1)
                text = line.decode('utf-8', errors='replace').rstrip('\r')
                log.write(text + '\n')
                log.flush()
                print(text, flush=True)
        if pending:
            log.write(pending.decode('utf-8', errors='replace'))
