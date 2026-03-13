import { Router } from 'express';

const router = Router();

// Placeholder for file upload routes
// TODO: Implement file upload functionality as needed

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'File upload service is running' });
});

export default router;
