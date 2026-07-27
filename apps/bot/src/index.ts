import express, { json } from 'express';
import { initializeBotService } from './server';

const app = express();
app.use(json());

initializeBotService(app);

const port = process.env.PORT ? Number(process.env.PORT) : 5001;
app.listen(port, () => {
  process.stdout.write(`FantaDrama bot service running on port ${port}\n`);
});
