/**
 * Payment Routes
 * Handles Stripe payment processing and subscription management
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { stripeService } from '../services/stripe.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import Stripe from 'stripe';

const router = express.Router();

/**
 * POST /api/payment/create-checkout-session
 * Create Stripe checkout session for subscription
 */
router.post('/create-checkout-session', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { packageId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    if (!packageId) {
      throw new AppError('Package ID is required', 400);
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripeService.createCheckoutSession({
      userId,
      packageId,
      successUrl: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/payment/cancel`
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error: any) {
    logger.error('Failed to create checkout session:', error);
    next(error);
  }
});

/**
 * POST /api/payment/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(400).send('Webhook secret not configured');
  }

  if (!sig) {
    return res.status(400).send('Missing stripe-signature header');
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(400).send('Stripe not configured');
    }

    // Get Stripe instance
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    });

    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    
    await stripeService.handleWebhook(event);

    res.json({ received: true });
  } catch (error: any) {
    logger.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

/**
 * POST /api/payment/cancel-subscription
 * Cancel user's subscription
 */
router.post('/cancel-subscription', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { User } = await import('../models/User.model.js');
    const user = await User.findById(userId);

    if (!user || !user.stripeSubscriptionId) {
      throw new AppError('No active subscription found', 404);
    }

    await stripeService.cancelSubscription(user.stripeSubscriptionId);

    res.json({
      success: true,
      message: 'Subscription canceled successfully'
    });
  } catch (error: any) {
    logger.error('Failed to cancel subscription:', error);
    next(error);
  }
});

/**
 * POST /api/payment/update-subscription
 * Update subscription (upgrade/downgrade)
 */
router.post('/update-subscription', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { packageId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    if (!packageId) {
      throw new AppError('Package ID is required', 400);
    }

    const { User } = await import('../models/User.model.js');
    const user = await User.findById(userId);

    if (!user || !user.stripeSubscriptionId) {
      throw new AppError('No active subscription found', 404);
    }

    await stripeService.updateSubscription({
      subscriptionId: user.stripeSubscriptionId,
      newPackageId: packageId
    });

    res.json({
      success: true,
      message: 'Subscription updated successfully'
    });
  } catch (error: any) {
    logger.error('Failed to update subscription:', error);
    next(error);
  }
});

export default router;




