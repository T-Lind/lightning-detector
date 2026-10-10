"""Convert a reviewed PEM root certificate to an ignored firmware header."""
import argparse
from pathlib import Path
import ssl
p=argparse.ArgumentParser()
p.add_argument('pem',type=Path,help='PEM root CA for the deployed API hostname')
a=p.parse_args()
pem=a.pem.read_text(encoding='ascii')
ssl.PEM_cert_to_DER_cert(pem) # Reject malformed PEM; hostname chain check is separate.
if ')CERT"' in pem:
    raise ValueError('Unexpected content')
out=Path(__file__).resolve().parents[1]/'firmware/include/tls_ca.h'
out.write_text('#pragma once\nstatic const char TLS_CA_CERT[] = R"CERT(\n'+pem+'\n)CERT";\n',encoding='ascii')
print('Wrote',out,'; verify the HTTPS chain before deploying.')
