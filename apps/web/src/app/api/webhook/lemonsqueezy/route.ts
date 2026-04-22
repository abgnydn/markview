import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * LemonSqueezy Webhook Handler
 * 
 * Verifies the webhook signature and processes events:
 * - order_created
 * - subscription_created
 * - subscription_updated
 * - subscription_cancelled
 * - license_key_created
 * 
 * Webhook URL: https://markview.ai/api/webhook/lemonsqueezy
 */

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[LemonSqueezy] LEMONSQUEEZY_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // Verify the webhook signature
    if (!verifySignature(rawBody, signature, secret)) {
      console.error('[LemonSqueezy] Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventName: string = event.meta?.event_name;
    const customData = event.meta?.custom_data;

    console.log(`[LemonSqueezy] Received event: ${eventName}`);

    switch (eventName) {
      case 'order_created': {
        const order = event.data;
        console.log(`[LemonSqueezy] Order created: ${order.id}`, {
          customerEmail: order.attributes?.user_email,
          total: order.attributes?.total_formatted,
          status: order.attributes?.status,
        });
        break;
      }

      case 'subscription_created': {
        const subscription = event.data;
        console.log(`[LemonSqueezy] Subscription created: ${subscription.id}`, {
          customerEmail: subscription.attributes?.user_email,
          status: subscription.attributes?.status,
          productName: subscription.attributes?.product_name,
          variantName: subscription.attributes?.variant_name,
        });
        break;
      }

      case 'subscription_updated': {
        const subscription = event.data;
        console.log(`[LemonSqueezy] Subscription updated: ${subscription.id}`, {
          status: subscription.attributes?.status,
          endsAt: subscription.attributes?.ends_at,
          renewsAt: subscription.attributes?.renews_at,
        });
        break;
      }

      case 'subscription_cancelled': {
        const subscription = event.data;
        console.log(`[LemonSqueezy] Subscription cancelled: ${subscription.id}`, {
          customerEmail: subscription.attributes?.user_email,
          endsAt: subscription.attributes?.ends_at,
        });
        break;
      }

      case 'license_key_created': {
        const licenseKey = event.data;
        console.log(`[LemonSqueezy] License key created: ${licenseKey.id}`, {
          key: licenseKey.attributes?.key,
          activationLimit: licenseKey.attributes?.activation_limit,
          expiresAt: licenseKey.attributes?.expires_at,
        });
        break;
      }

      default:
        console.log(`[LemonSqueezy] Unhandled event: ${eventName}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[LemonSqueezy] Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
