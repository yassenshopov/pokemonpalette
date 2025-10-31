import { clerkClient } from "@clerk/nextjs/server";
import { syncUserFromClerk } from "./user-service";

/**
 * Utility function to sync all existing Clerk users to the database
 * This should be run once after setting up the webhook to migrate existing users
 */
export async function migrateExistingClerkUsers() {
  try {
    console.log("Starting migration of existing Clerk users...");
    
    // Get all users from Clerk
    const clerkUsers = await clerkClient.users.getUserList({
      limit: 500, // Adjust as needed
    });

    console.log(`Found ${clerkUsers.totalCount} users in Clerk`);

    let successCount = 0;
    let errorCount = 0;

    // Process each user
    for (const clerkUser of clerkUsers.data) {
      try {
        await syncUserFromClerk({
          id: clerkUser.id,
          email_addresses: clerkUser.emailAddresses.map(email => ({
            email_address: email.emailAddress,
            id: email.id,
          })),
          first_name: clerkUser.firstName,
          last_name: clerkUser.lastName,
          image_url: clerkUser.imageUrl,
          created_at: clerkUser.createdAt,
          updated_at: clerkUser.updatedAt,
        });
        
        successCount++;
        console.log(`✅ Migrated user: ${clerkUser.id} (${clerkUser.emailAddresses[0]?.emailAddress})`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to migrate user ${clerkUser.id}:`, error);
      }
    }

    console.log(`Migration completed: ${successCount} successful, ${errorCount} failed`);
    return { successCount, errorCount, totalCount: clerkUsers.totalCount };
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
