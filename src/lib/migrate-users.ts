import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Utility function to sync all existing Clerk users to the database
 * This should be run once after setting up the webhook to migrate existing users
 */
export async function migrateExistingClerkUsers() {
  try {
    console.log("Starting migration of existing Clerk users...");
    
    const client = await clerkClient();
    let allUsers: any[] = [];
    let offset = 0;
    const limit = 500; // Clerk's max limit per request
    let hasMore = true;

    // Fetch all users with pagination
    while (hasMore) {
      const response = await client.users.getUserList({
        limit,
        offset,
      });

      allUsers = allUsers.concat(response.data);
      console.log(`Fetched ${allUsers.length} of ${response.totalCount} users...`);

      // Check if there are more users to fetch
      hasMore = response.data.length === limit && allUsers.length < response.totalCount;
      offset += limit;
    }

    console.log(`Found ${allUsers.length} total users in Clerk`);
    console.log(`Starting migration of ${allUsers.length} users...`);

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    // Process each user
    for (const clerkUser of allUsers) {
      try {
        // Clerk SDK returns camelCase properties
        const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress || null;
        const createdAt = clerkUser.createdAt ? new Date(clerkUser.createdAt) : new Date();
        const updatedAt = clerkUser.updatedAt ? new Date(clerkUser.updatedAt) : new Date();
        const lastActiveAt = clerkUser.lastActiveAt ? new Date(clerkUser.lastActiveAt).toISOString() : null;
        const lastSignInAt = clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt).toISOString() : null;
        
        // Use upsert to handle both new and existing users (matches webhook pattern)
        const { data: user, error } = await supabaseAdmin
          .from('users')
          .upsert({
            id: clerkUser.id,
            email: primaryEmail,
            first_name: clerkUser.firstName || null,
            last_name: clerkUser.lastName || null,
            username: clerkUser.username || null,
            image_url: clerkUser.imageUrl || null,
            profile_image_url: clerkUser.profileImageUrl || null,
            has_image: clerkUser.hasImage || false,
            primary_email_address_id: clerkUser.primaryEmailAddressId || null,
            primary_phone_number_id: clerkUser.primaryPhoneNumberId || null,
            banned: clerkUser.banned || false,
            locked: clerkUser.locked || false,
            backup_code_enabled: clerkUser.backupCodeEnabled || false,
            two_factor_enabled: clerkUser.twoFactorEnabled || false,
            totp_enabled: clerkUser.totpEnabled || false,
            password_enabled: clerkUser.passwordEnabled || false,
            create_organization_enabled: clerkUser.createOrganizationEnabled ?? true,
            delete_self_enabled: clerkUser.deleteSelfEnabled ?? true,
            last_active_at: lastActiveAt,
            last_sign_in_at: lastSignInAt,
            created_at: createdAt.toISOString(),
            updated_at: updatedAt.toISOString(),
            is_deleted: false,
            email_addresses: clerkUser.emailAddresses || [],
            phone_numbers: clerkUser.phoneNumbers || [],
            external_accounts: clerkUser.externalAccounts || [],
            public_metadata: clerkUser.publicMetadata || {},
            private_metadata: clerkUser.privateMetadata || {},
            unsafe_metadata: clerkUser.unsafeMetadata || {},
          }, {
            onConflict: 'id',
            ignoreDuplicates: false,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        successCount++;
        if (successCount % 50 === 0) {
          console.log(`Progress: ${successCount}/${allUsers.length} users migrated...`);
        }
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ userId: clerkUser.id, error: errorMessage });
        console.error(`❌ Failed to migrate user ${clerkUser.id}:`, errorMessage);
      }
    }

    console.log(`\n=== Migration Summary ===`);
    console.log(`Total users in Clerk: ${allUsers.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    if (errors.length > 0) {
      console.log(`\nErrors encountered:`);
      errors.slice(0, 10).forEach(({ userId, error }) => {
        console.log(`  - ${userId}: ${error}`);
      });
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors`);
      }
    }

    return { 
      successCount, 
      errorCount, 
      totalCount: allUsers.length,
      errors: errors.slice(0, 50) // Return first 50 errors to avoid huge response
    };
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  }
}

/**
 * API route handler for manual migration trigger
 * Create an API route at /api/migrate-users to use this
 */
export async function handleMigrationRequest() {
  try {
    const result = await migrateExistingClerkUsers();
    return {
      success: true,
      message: `Migration completed: ${result.successCount}/${result.totalCount} users migrated successfully`,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      message: "Migration failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
