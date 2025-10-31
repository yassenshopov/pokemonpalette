import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { supabaseAdmin } from "@/lib/supabase";

// Clerk webhook event types based on actual payload
type ClerkWebhookEvent = {
  type: string;
  data: {
    id: string;
    object: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string;
    profile_image_url: string;
    has_image: boolean;
    primary_email_address_id: string | null;
    primary_phone_number_id: string | null;
    primary_web3_wallet_id: string | null;
    banned: boolean;
    locked: boolean;
    lockout_expires_in_seconds: number | null;
    verification_attempts_remaining: number;
    backup_code_enabled: boolean;
    two_factor_enabled: boolean;
    totp_enabled: boolean;
    password_enabled: boolean;
    create_organization_enabled: boolean;
    delete_self_enabled: boolean;
    last_active_at: number;
    last_sign_in_at: number | null;
    created_at: number;
    updated_at: number;
    email_addresses: Array<{
      id: string;
      object: string;
      email_address: string;
      reserved: boolean;
      verification: {
        status: string;
        strategy: string;
        attempts: number | null;
        expire_at: number | null;
      };
      linked_to: Array<{
        id: string;
        type: string;
      }>;
      created_at: number;
      updated_at: number;
    }>;
    phone_numbers: Array<any>;
    web3_wallets: Array<any>;
    external_accounts: Array<{
      id: string;
      object: string;
      provider: string;
      provider_user_id: string;
      email_address: string;
      first_name: string;
      last_name: string;
      image_url: string;
      username: string | null;
      public_metadata: Record<string, any>;
      label: string | null;
      created_at: number;
      updated_at: number;
      verification: {
        status: string;
        strategy: string;
        attempts: number | null;
        expire_at: number;
      };
    }>;
    saml_accounts: Array<any>;
    enterprise_accounts: Array<any>;
    passkeys: Array<any>;
    public_metadata: Record<string, any>;
    private_metadata: Record<string, any>;
    unsafe_metadata: Record<string, any>;
  };
};

export async function POST(req: NextRequest) {
  console.log("🔔 Webhook received");
  
  try {
    // Get the headers (await for Next.js 15 compatibility)
    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    console.log("📋 Headers:", { svix_id, svix_timestamp, svix_signature: !!svix_signature });

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error("❌ Missing svix headers");
      return new Response("Error occurred -- no svix headers", {
        status: 400,
      });
    }

    // Get the body
    const payload = await req.text();
    console.log("📦 Raw payload length:", payload.length);
    
    let body;
    try {
      body = JSON.parse(payload);
      console.log("📄 Parsed body type:", body.type);
      console.log("👤 User ID:", body.data?.id);
    } catch (parseError) {
      console.error("❌ Error parsing JSON:", parseError);
      return new Response("Invalid JSON payload", { status: 400 });
    }

    // Get the Webhook secret
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      console.error("❌ CLERK_WEBHOOK_SECRET not found in environment variables");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    console.log("🔐 Webhook secret configured:", !!WEBHOOK_SECRET);

    // Create a new Svix instance with your secret.
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt: ClerkWebhookEvent;

    // Verify the payload with the headers
    try {
      evt = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as ClerkWebhookEvent;
      console.log("✅ Webhook signature verified");
    } catch (err) {
      console.error("❌ Error verifying webhook signature:", err);
      return new Response("Webhook signature verification failed", {
        status: 400,
      });
    }

    // Handle the webhook
    const eventType = evt.type;
    console.log(`🎯 Processing webhook: ${eventType} for user ${evt.data.id}`);
    console.log("📊 User data:", {
      id: evt.data.id,
      email: evt.data.email_addresses?.[0]?.email_address,
      firstName: evt.data.first_name,
      lastName: evt.data.last_name,
      imageUrl: evt.data.image_url
    });

    try {
      switch (eventType) {
        case "user.created":
          await handleUserCreated(evt.data);
          break;
        case "user.updated":
          await handleUserUpdated(evt.data);
          break;
        case "user.deleted":
          await handleUserDeleted(evt.data);
          break;
        default:
          console.log(`⚠️ Unhandled event type: ${eventType}`);
      }

      console.log("✅ Webhook processed successfully");
      return NextResponse.json({ 
        message: "Webhook processed successfully",
        eventType,
        userId: evt.data.id
      });
    } catch (error) {
      console.error("❌ Error processing webhook:", error);
      return new Response(`Error processing webhook: ${error}`, { status: 500 });
    }
  } catch (error) {
    console.error("❌ Unexpected error in webhook handler:", error);
    return new Response(`Unexpected error: ${error}`, { status: 500 });
  }
}

async function handleUserCreated(userData: ClerkWebhookEvent["data"]) {
  const primaryEmail = userData.email_addresses?.[0]?.email_address || null;
  
  console.log(`👤 Creating user: ${userData.id}`);
  console.log(`📧 Email: ${primaryEmail}`);
  console.log(`🖼️ Has image: ${userData.has_image}`);

  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        id: userData.id,
        email: primaryEmail,
        first_name: userData.first_name,
        last_name: userData.last_name,
        username: userData.username,
        image_url: userData.image_url,
        profile_image_url: userData.profile_image_url,
        has_image: userData.has_image,
        primary_email_address_id: userData.primary_email_address_id,
        primary_phone_number_id: userData.primary_phone_number_id,
        banned: userData.banned,
        locked: userData.locked,
        backup_code_enabled: userData.backup_code_enabled,
        two_factor_enabled: userData.two_factor_enabled,
        totp_enabled: userData.totp_enabled,
        password_enabled: userData.password_enabled,
        create_organization_enabled: userData.create_organization_enabled,
        delete_self_enabled: userData.delete_self_enabled,
        last_active_at: new Date(userData.last_active_at).toISOString(),
        last_sign_in_at: userData.last_sign_in_at ? new Date(userData.last_sign_in_at).toISOString() : null,
        created_at: new Date(userData.created_at).toISOString(),
        updated_at: new Date(userData.updated_at).toISOString(),
        is_deleted: false,
        email_addresses: userData.email_addresses,
        phone_numbers: userData.phone_numbers,
        external_accounts: userData.external_accounts,
        public_metadata: userData.public_metadata,
        private_metadata: userData.private_metadata,
        unsafe_metadata: userData.unsafe_metadata,
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ Supabase error creating user ${userData.id}:`, error);
      throw error;
    }

    console.log(`✅ User created in database: ${userData.id}`);
    console.log(`📊 Created user:`, {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      has_image: user.has_image,
      banned: user.banned,
      locked: user.locked
    });
  } catch (error) {
    console.error(`❌ Error creating user ${userData.id}:`, error);
    throw error;
  }
}

async function handleUserUpdated(userData: ClerkWebhookEvent["data"]) {
  const primaryEmail = userData.email_addresses?.[0]?.email_address || null;
  
  console.log(`🔄 Updating user: ${userData.id}`);

  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({
        email: primaryEmail,
        first_name: userData.first_name,
        last_name: userData.last_name,
        username: userData.username,
        image_url: userData.image_url,
        profile_image_url: userData.profile_image_url,
        has_image: userData.has_image,
        primary_email_address_id: userData.primary_email_address_id,
        primary_phone_number_id: userData.primary_phone_number_id,
        banned: userData.banned,
        locked: userData.locked,
        backup_code_enabled: userData.backup_code_enabled,
        two_factor_enabled: userData.two_factor_enabled,
        totp_enabled: userData.totp_enabled,
        password_enabled: userData.password_enabled,
        create_organization_enabled: userData.create_organization_enabled,
        delete_self_enabled: userData.delete_self_enabled,
        last_active_at: new Date(userData.last_active_at).toISOString(),
        last_sign_in_at: userData.last_sign_in_at ? new Date(userData.last_sign_in_at).toISOString() : null,
        updated_at: new Date(userData.updated_at).toISOString(),
        email_addresses: userData.email_addresses,
        phone_numbers: userData.phone_numbers,
        external_accounts: userData.external_accounts,
        public_metadata: userData.public_metadata,
        private_metadata: userData.private_metadata,
        unsafe_metadata: userData.unsafe_metadata,
      })
      .eq('id', userData.id)
      .select()
      .single();

    if (error) {
      console.error(`❌ Supabase error updating user ${userData.id}:`, error);
      throw error;
    }

    console.log(`✅ User updated in database: ${userData.id}`);
    console.log(`📊 Updated user:`, {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      has_image: user.has_image,
      banned: user.banned,
      locked: user.locked
    });
  } catch (error) {
    console.error(`❌ Error updating user ${userData.id}:`, error);
    throw error;
  }
}

async function handleUserDeleted(userData: ClerkWebhookEvent["data"]) {
  console.log(`🗑️ Soft deleting user: ${userData.id}`);
  
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userData.id)
      .select()
      .single();

    if (error) {
      console.error(`❌ Supabase error deleting user ${userData.id}:`, error);
      throw error;
    }

    console.log(`✅ User soft deleted in database: ${userData.id}`);
    console.log(`📊 Deleted user:`, {
      id: user.id,
      email: user.email,
      is_deleted: user.is_deleted
    });
  } catch (error) {
    console.error(`❌ Error deleting user ${userData.id}:`, error);
    throw error;
  }
}
