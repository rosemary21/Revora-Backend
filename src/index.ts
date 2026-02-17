import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';

const app = express();
const port = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'revora-backend' });
});

app.get('/api/overview', (_req: Request, res: Response) => {
  res.json({
    name: 'Stellar RevenueShare (Revora) Backend',
    description:
      'Backend API skeleton for tokenized revenue-sharing on Stellar (offerings, investments, revenue distribution).'
  });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`revora-backend listening on http://localhost:${port}`);
});

