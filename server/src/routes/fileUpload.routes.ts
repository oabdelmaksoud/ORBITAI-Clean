import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Feature coming soon — all endpoints return 503 until backend is implemented (TODO #67)
const comingSoon = (_req: any, res: any) => {
  res.status(503).set('Retry-After', '86400').json({
    success: false,
    error: 'File upload feature is not yet available.',
    retryAfter: '86400',
  });
};

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'File upload service is running' });
});

router.post('/upload', authenticateToken, comingSoon);
router.delete('/:fileId', authenticateToken, comingSoon);

export default router;
