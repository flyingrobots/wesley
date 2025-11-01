#!/usr/bin/env node
// Print only the HTTP status code for a raw request path without client normalization.
import net from 'node:net';

const port = Number(process.env.PORT || '');
const path = String(process.env.PATHQ || '/');
if (!Number.isFinite(port) || port <= 0) {
  console.error('Invalid PORT:', process.env.PORT);
  process.exit(2);
}

const c = net.createConnection({ host: '127.0.0.1', port }, () => {
  c.write('GET ' + path + ' HTTP/1.1\r\n' +
          'Host: 127.0.0.1:' + port + '\r\n' +
          'Connection: close\r\n\r\n');
});
let buf = '';
c.on('data', (d) => { buf += d.toString(); });
c.on('end', () => {
  const m = buf.match(/^HTTP\/\d\.\d\s+(\d+)/);
  console.log(m ? m[1] : '');
});
c.on('error', (e) => { console.error(e && e.message ? e.message : String(e)); process.exit(1); });

