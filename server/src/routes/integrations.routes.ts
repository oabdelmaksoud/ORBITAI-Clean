import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Feature coming soon — all endpoints return 503 until backend is implemented (TODO #67)
const comingSoon = (_req: any, res: any) => {
  res.status(503).set('Retry-After', '86400').json({
    success: false,
    error: 'Integrations feature is not yet available.',
    retryAfter: '86400',
  });
};

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Integrations service is running' });
});

router.get('/', authenticateToken, comingSoon);
router.post('/', authenticateToken, comingSoon);
router.delete('/:integrationId', authenticateToken, comingSoon);

export default router;
