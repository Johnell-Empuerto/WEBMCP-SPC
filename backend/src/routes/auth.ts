import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { authController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Login-specific rate limiter: 10 FAILED attempts per 15 minutes per IP.
// Successful logins do not count (skipSuccessfulRequests), so normal users are
// never affected — this only slows down credential-stuffing attacks.
// The global /api limiter (see index.ts) still applies on top.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const normalizedIp = ip.replace(/^\[|\]$/g, "");
    return ipKeyGenerator(normalizedIp);
  },
  message: {
    success: false,
    message: 'Too many failed login attempts. Please try again in 15 minutes.',
  },
});

router.post('/login', loginLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.profile(req, res, next));
router.post('/logout', authenticate, (req, res) => authController.logout(req, res));

export default router;
