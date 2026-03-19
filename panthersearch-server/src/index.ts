import cors from 'cors';
import express from 'express';
import gradesRouter from './routes/grades';
import professorRouter from './routes/professor';
import redditRouter from './routes/reddit';
import seatsRouter from './routes/seats';

const app = express();
const PORT = 3001;

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'PantherSearch API' });
});

app.use('/api/grades', gradesRouter);
app.use('/api/seats', seatsRouter);
app.use('/api/professor', professorRouter);
app.use('/api/reddit', redditRouter);

app.listen(PORT, () => {
  console.log(`PantherSearch API running at http://localhost:${PORT}`);
});
