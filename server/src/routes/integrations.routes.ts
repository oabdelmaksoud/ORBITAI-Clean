import { Router } from 'express';

const router = Router();

// Placeholder for integrations routes
// TODO: Implement integration routes as needed

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Integrations service is running' });
});

// TODO(#67): Implement integration endpoints
router.get('/', (_req, res) => {
  res.status(501).json({ success: false, error: 'Integrations listing not yet implemented' });
});

router.post('/', (_req, res) => {
  res.status(501).json({ success: false, error: 'Integration creation not yet implemented' });
});

router.delete('/:integrationId', (_req, res) => {
  res.status(501).json({ success: false, error: 'Integration deletion not yet implemented' });
});

export default router;
