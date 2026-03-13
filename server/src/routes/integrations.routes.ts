import { Router } from 'express';

const router = Router();

// Placeholder for integrations routes
// TODO: Implement integration routes as needed

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Integrations service is running' });
});

export default router;













