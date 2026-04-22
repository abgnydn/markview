import { NextRequest, NextResponse } from 'next/server';

/**
 * LemonSqueezy License Validation API
 * 
 * Verifies and activates a license key via the LemonSqueezy API.
 * Uses native fetch to ensure compatibility without needing complex SDK setups.
 */

export async function POST(request: NextRequest) {
  try {
    const { licenseKey, instanceName = 'markview-app' } = await request.json();

    if (!licenseKey) {
      return NextResponse.json({ error: 'License key is required' }, { status: 400 });
    }

    // Call the LemonSqueezy API directly to activate the license key
    const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        license_key: licenseKey,
        instance_name: instanceName,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json({ 
        valid: false, 
        error: data.error || 'Failed to activate license key' 
      }, { status: 400 });
    }

    if (data.activated) {
      return NextResponse.json({
        valid: true,
        instanceId: data.instance.id,
        licenseKeyId: data.license_key.id,
        status: data.license_key.status, // e.g. "active"
        meta: data.meta
      });
    }

    return NextResponse.json({ valid: false, error: 'License key could not be activated' }, { status: 400 });
  } catch (error) {
    console.error('[LemonSqueezy] Failed to verify license:', error);
    return NextResponse.json({ error: 'Internal server error while verifying license' }, { status: 500 });
  }
}
