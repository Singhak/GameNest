import { createServer } from 'http';
import { handler } from '../dist/main';

export default async function (req, res) {
  const server = createServer(handler);
  server.emit('request', req, res);
}
