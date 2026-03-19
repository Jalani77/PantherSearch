import { Router } from 'express';
import { fetchRedditResults } from '../scrapers/redditFetcher';

const router = Router();

router.get('/:query', async (req, res) => {
  try {
    const payload = await fetchRedditResults(req.params.query);
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      message: 'Unable to retrieve Reddit results right now.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
