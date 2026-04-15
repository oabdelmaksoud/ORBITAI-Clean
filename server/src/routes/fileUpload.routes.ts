import { Router } from 'express';

const router = Router();

// Placeholder for file upload routes
// TODO: Implement file upload functionality as needed

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'File upload service is running' });
});

// TODO(#67): Implement file upload functionality
router.post('/upload', (_req, res) => {
  res.status(501).json({ success: false, error: 'File upload not yet implemented' });
});

router.delete('/:fileId', (_req, res) => {
  res.status(501).json({ success: false, error: 'File deletion not yet implemented' });
});

export default router;
