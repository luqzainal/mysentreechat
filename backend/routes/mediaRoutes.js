import express from 'express';
const router = express.Router();
import { 
    uploadMedia, 
    getMediaList, 
    deleteMedia 
} from '../controllers/mediaController.js';
import { protect } from '../middleware/authMiddleware.js';

// GET /media - Dapatkan senarai media pengguna
router.get('/', protect, getMediaList);

// POST /media/upload - Muat naik fail media baru
// Middleware 'protect' akan pastikan req.user._id wujud untuk multer
router.post('/upload', protect, uploadMedia);

// DELETE /media/:id - Padam fail media
router.delete('/:id', protect, deleteMedia);

export default router; 