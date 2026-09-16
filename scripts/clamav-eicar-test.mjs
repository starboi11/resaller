import { createConnection } from 'node:net';

const host = process.env.CLAMAV_HOST ?? '127.0.0.1';
const port = Number(process.env.CLAMAV_PORT ?? 3310);
const eicar = Buffer.from(
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
);

const result = await new Promise((resolve, reject) => {
  const socket = createConnection({ host, port });
  let response = '';
  socket.setTimeout(15_000);
  socket.on('connect', () => {
    socket.write(Buffer.from('zINSTREAM\0'));
    const size = Buffer.alloc(4);
    size.writeUInt32BE(eicar.length);
    socket.write(size);
    socket.write(eicar);
    socket.end(Buffer.alloc(4));
  });
  socket.on('data', (chunk) => (response += chunk.toString('utf8')));
  socket.on('end', () => resolve(response));
  socket.on('timeout', () => reject(new Error('ClamAV timed out')));
  socket.on('error', reject);
});

console.log(result.trim());
if (!String(result).includes('FOUND')) {
  console.error('ClamAV did not reject the standard EICAR test signature.');
  process.exit(1);
}
