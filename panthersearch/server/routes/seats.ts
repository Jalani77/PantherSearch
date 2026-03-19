import { Router } from 'express';
import { fetchBannerSeats } from '../scrapers/bannerScraper';

const router = Router();

router.get('/:courseCode', async (req, res) => {
  try {
    const payload = await fetchBannerSeats(req.params.courseCode, req.query.term as string | undefined);
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      message: 'Unable to retrieve live seat availability from GoSolar right now.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
