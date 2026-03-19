import { Router } from 'express';
import { fetchProfessorRmp } from '../scrapers/rmpScraper';

const router = Router();

router.get('/:name', async (req, res) => {
  try {
    const payload = await fetchProfessorRmp(req.params.name);
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      message: 'Unable to retrieve RateMyProfessors data right now.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
