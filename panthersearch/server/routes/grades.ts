import { Router } from 'express';
import { fetchIportGrades } from '../scrapers/iportScraper';

const router = Router();

router.get('/:courseCode', async (req, res) => {
  try {
    const payload = await fetchIportGrades(req.params.courseCode);
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      message: 'Unable to retrieve grade distribution from IPORT right now.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
