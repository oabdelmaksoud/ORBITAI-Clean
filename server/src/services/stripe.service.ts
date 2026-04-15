/**
 * Stripe Service
 * Handles Stripe payment processing and subscription management
 */

import { logger } from '../utils/logger.js';
import { User } from '../models/User.model.js';
import { Package } from '../models/Package.model.js';

// Lazy load Stripe
let StripeModule: any = null;
let stripeInstance: any = null;

async function getStripe() {
  if (stripeInstance) {
    return stripeInstance;
  }

  try {
    if (!StripeModule) {
      const stripeImport = await import('stripe');
      StripeModule = stripeImport.default || stripeImport;
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      logger.warn('STRIPE_SECRET_KEY not configured. Stripe integration will be disabled.');
      return null;
    }

    stripeInstance = new StripeModule(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    });

    return stripeInstance;
  } catch (error: unknown) {
    logger.warn('Stripe package not installed. Run: npm install stripe');
    return null;
  }
}

export interface CreateCheckoutSessionParams {
  userId: string;
  packageId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface SubscriptionUpdateParams {
  subscriptionId: string;
  newPackageId: string;
}

class StripeService {
  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<any> {
    const stripe = await getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }

    try {
      const user = await User.findById(params.userId);
      if (!user) {
        throw new Error('User not found');
      }

      const pkg = await Package.findById(params.packageId);
      if (!pkg) {
        throw new Error('Package not found');
      }

      // Create Stripe customer if doesn't exist
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: user._id.toString()
          }
        });
        customerId = customer.id;
        user.stripeCustomerId = customerId;
        await user.save();
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: pkg.displayName || pkg.name,
                description: pkg.description || ''
              },
              recurring: {
                interval: pkg.billingCycle === 'monthly' ? 'month' : 'year',
                interval_count: 1
              },
              unit_amount: Math.round(pkg.price * 100) // Convert to cents
            },
            quantity: 1
          }
        ],
        mode: 'subscription',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          userId: params.userId,
          packageId: params.packageId
        }
      });

      logger.info(`Created Stripe checkout session: ${session.id} for user: ${params.userId}`);
      return session;
    } catch (error: unknown) {
      logger.error('Failed to create Stripe checkout session:', error);
      throw error;
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event: any): Promise<void> {
    const stripe = await getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        default:
          logger.debug(`Unhandled Stripe webhook event: ${event.type}`);
      }
    } catch (error: unknown) {
      logger.error(`Failed to handle Stripe webhook ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Handle checkout session completed
   */
  private async handleCheckoutCompleted(session: any): Promise<void> {
    const userId = session.metadata?.userId;
    const packageId = session.metadata?.packageId;

    if (!userId || !packageId) {
      logger.warn('Checkout session missing metadata:', session.id);
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`User not found for checkout session: ${userId}`);
      return;
    }

    // Update user subscription
    user.plan = packageId;
    user.subscriptionStatus = 'active';
    user.stripeSubscriptionId = session.subscription as string;
    await user.save();

    logger.info(`User ${userId} subscribed to package ${packageId} via Stripe`);
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    const customerId = subscription.customer as string;
    const user = await User.findOne({ stripeCustomerId: customerId });

    if (!user) {
      logger.warn(`User not found for subscription: ${customerId}`);
      return;
    }

    user.stripeSubscriptionId = subscription.id;
    user.subscriptionStatus = subscription.status === 'active' ? 'active' : 'past_due';
    await user.save();

    logger.info(`Updated subscription for user: ${user._id}`);
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    const customerId = subscription.customer as string;
    const user = await User.findOne({ stripeCustomerId: customerId });

    if (!user) {
      logger.warn(`User not found for deleted subscription: ${customerId}`);
      return;
    }

    user.subscriptionStatus = 'canceled';
    user.stripeSubscriptionId = undefined;
    await user.save();

    logger.info(`Canceled subscription for user: ${user._id}`);
  }

  /**
   * Handle payment succeeded
   */
  private async handlePaymentSucceeded(invoice: any): Promise<void> {
    const customerId = invoice.customer as string;
    const user = await User.findOne({ stripeCustomerId: customerId });

    if (user) {
      user.subscriptionStatus = 'active';
      await user.save();
      logger.info(`Payment succeeded for user: ${user._id}`);
    }
  }

  /**
   * Handle payment failed
   */
  private async handlePaymentFailed(invoice: any): Promise<void> {
    const customerId = invoice.customer as string;
    const user = await User.findOne({ stripeCustomerId: customerId });

    if (user) {
      user.subscriptionStatus = 'past_due';
      await user.save();
      logger.warn(`Payment failed for user: ${user._id}`);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<any> {
    const stripe = await getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      logger.info(`Canceled Stripe subscription: ${subscriptionId}`);
      return subscription;
    } catch (error: unknown) {
      logger.error(`Failed to cancel subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(params: SubscriptionUpdateParams): Promise<any> {
    const stripe = await getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const subscription = await stripe.subscriptions.retrieve(params.subscriptionId);
      const pkg = await Package.findById(params.newPackageId);
      if (!pkg) {
        throw new Error('Package not found');
      }

      // Update subscription with new price
      const updated = await stripe.subscriptions.update(params.subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price_data: {
            currency: 'usd',
            product_data: {
              name: pkg.displayName || pkg.name,
              description: pkg.description || ''
            },
            recurring: {
              interval: pkg.billingCycle === 'monthly' ? 'month' : 'year',
              interval_count: 1
            },
            unit_amount: Math.round(pkg.price * 100)
          }
        }],
        proration_behavior: 'always_invoice'
      });

      // Update user package
      const user = await User.findOne({ stripeSubscriptionId: params.subscriptionId });
      if (user) {
        user.plan = params.newPackageId;
        await user.save();
      }

      logger.info(`Updated subscription ${params.subscriptionId} to package ${params.newPackageId}`);
      return updated;
    } catch (error: unknown) {
      logger.error(`Failed to update subscription:`, error);
      throw error;
    }
  }
}

export const stripeService = new StripeService();
