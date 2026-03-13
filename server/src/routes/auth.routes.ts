import express from 'express';
import { z } from 'zod';
import { User } from '../models/User.model.js';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const oauthSchema = z.object({
  provider: z.enum(['google', 'github', 'discord']),
  credential: z.string().min(1) // Token from Google, or Code from GitHub/Discord
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: User already exists
 *       400:
 *         description: Validation error
 */
// Register (with strict rate limiting to prevent brute force)
// SECURITY: Added input validation with Zod schema
router.post('/register', strictRateLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('User already exists with this email', 409);
    }

    // Create new user
    const user = await User.create({
      email,
      password,
      name,
      plan: 'Free'
    });

    const token = generateToken(user._id.toString(), user.email, user.plan, user.role);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          plan: user.plan,
          role: user.role,
          privacyMode: user.privacyMode ?? false // Include privacy mode in register response
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       400:
 *         description: Validation error
 */
// Login (with strict rate limiting to prevent brute force)
// SECURITY: Added input validation with Zod schema
router.post('/login', strictRateLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = generateToken(user._id.toString(), user.email, user.plan, user.role);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          plan: user.plan,
          role: user.role,
          privacyMode: user.privacyMode ?? false // Include privacy mode in login response
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
// SECURITY FIX: Now requires JWT authentication instead of header-based user ID
router.get('/me', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          plan: user.plan,
          role: user.role,
          privacyMode: user.privacyMode ?? false // Include privacy mode
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get privacy settings
// SECURITY FIX: Now requires JWT authentication instead of header-based user ID
router.get('/privacy-settings', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: {
        privacyMode: user.privacyMode ?? false // Default to false if not set
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update privacy settings
// SECURITY FIX: Now requires JWT authentication instead of header-based user ID
router.put('/privacy-settings', authenticateToken, validate(z.object({ privacyMode: z.boolean() })), async (req: AuthRequest, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    const { privacyMode } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { privacyMode },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: {
        privacyMode: user.privacyMode
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/oauth:
 *   post:
 *     summary: Login/Register via OAuth provider
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - credential
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, github, discord]
 *               credential:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Validation error or invalid token
 */
router.post('/oauth', strictRateLimiter, validate(oauthSchema), async (req, res, next) => {
  try {
    const { provider, credential } = req.body;
    let oauthData: { oauthId: string; email: string; name: string; avatar?: string; email_verified?: boolean } | null = null;

    if (provider === 'google') {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new AppError('Invalid Google Token', 400);
      }
      oauthData = {
        oauthId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        avatar: payload.picture,
        email_verified: payload.email_verified
      };
    } else if (provider === 'github') {
      // Exchange code for token
      const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: credential
      }, { headers: { Accept: 'application/json' } });
      
      const accessToken = tokenRes.data.access_token;
      if (!accessToken) throw new AppError('Invalid GitHub Code', 400);

      const userRes = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const emailRes = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const primaryEmail = emailRes.data.find((e: any) => e.primary)?.email || emailRes.data[0]?.email;
      if (!primaryEmail) throw new AppError('No email found in GitHub account', 400);

      oauthData = {
        oauthId: userRes.data.id.toString(),
        email: primaryEmail,
        name: userRes.data.name || userRes.data.login || primaryEmail.split('@')[0],
        avatar: userRes.data.avatar_url
      };
    } else if (provider === 'discord') {
      // Exchange code for token
      const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || '',
        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code: credential,
        redirect_uri: process.env.DISCORD_REDIRECT_URI || ''
      });
      
      const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const accessToken = tokenRes.data.access_token;
      if (!accessToken) throw new AppError('Invalid Discord Code', 400);

      const userRes = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!userRes.data.email) throw new AppError('No email found in Discord account', 400);

      oauthData = {
        oauthId: userRes.data.id,
        email: userRes.data.email,
        name: userRes.data.global_name || userRes.data.username || userRes.data.email.split('@')[0],
        avatar: userRes.data.avatar ? `https://cdn.discordapp.com/avatars/${userRes.data.id}/${userRes.data.avatar}.png` : undefined
      };
    }

    if (!oauthData) {
      throw new AppError('Invalid OAuth Provider', 400);
    }

    // Check if user exists by oauthId OR email
    let user = await User.findOne({ 
      $or: [
        { oauthProvider: provider, oauthId: oauthData.oauthId },
        { email: oauthData.email }
      ]
    });

    if (user) {
      // Link account if logging in with new provider but same email
      if (!user.oauthProvider) {
        user.oauthProvider = provider as 'google' | 'github' | 'discord';
        user.oauthId = oauthData.oauthId;
        await user.save();
      }
    } else {
      // Create new user
      user = await User.create({
        email: oauthData.email,
        name: oauthData.name,
        avatar: oauthData.avatar || 'https://api.dicebear.com/9.x/avataaars/svg?seed=default',
        plan: 'Free',
        role: 'user',
        oauthProvider: provider,
        oauthId: oauthData.oauthId
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id.toString(), user.email, user.plan, user.role);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          plan: user.plan,
          role: user.role,
          privacyMode: user.privacyMode ?? false
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

