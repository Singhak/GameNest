import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import { VercelRequest, VercelResponse } from '@vercel/node';

const server = express();

let appInitialized = false;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  await app.init();
  appInitialized = true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!appInitialized) {
    await bootstrap();
  }
  server(req, res);
}
