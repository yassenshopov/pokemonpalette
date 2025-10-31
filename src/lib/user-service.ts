import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { User } from "@prisma/client";

export interface CreateUserData {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  profileImageUrl?: string | null;
  hasImage?: boolean;
  primaryEmailAddressId?: string | null;
  primaryPhoneNumberId?: string | null;
  banned?: boolean;
  locked?: boolean;
  backupCodeEnabled?: boolean;
  twoFactorEnabled?: boolean;
  totpEnabled?: boolean;
  passwordEnabled?: boolean;
  createOrganizationEnabled?: boolean;
  deleteSelfEnabled?: boolean;
  lastActiveAt?: Date | null;
  lastSignInAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  emailAddresses?: any;
  phoneNumbers?: any;
  externalAccounts?: any;
  publicMetadata?: any;
  privateMetadata?: any;
  unsafeMetadata?: any;
}

export interface UpdateUserData {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  profileImageUrl?: string | null;
  hasImage?: boolean;
  primaryEmailAddressId?: string | null;
  primaryPhoneNumberId?: string | null;
  banned?: boolean;
  locked?: boolean;
  backupCodeEnabled?: boolean;
  twoFactorEnabled?: boolean;
  totpEnabled?: boolean;
  passwordEnabled?: boolean;
  createOrganizationEnabled?: boolean;
  deleteSelfEnabled?: boolean;
  lastActiveAt?: Date | null;
  lastSignInAt?: Date | null;
  updatedAt?: Date;
  emailAddresses?: any;
  phoneNumbers?: any;
  externalAccounts?: any;
  publicMetadata?: any;
  privateMetadata?: any;
  unsafeMetadata?: any;
}

/**
 * Create a new user in the database
 */
export async function createUser(userData: CreateUserData): Promise<User> {
  try {
    const user = await prisma.user.create({
      data: {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        imageUrl: userData.imageUrl,
        createdAt: userData.createdAt || new Date(),
        updatedAt: userData.updatedAt || new Date(),
        isDeleted: false,
      },
    });

    console.log(`User created successfully: ${user.id}`);
    return user;
  } catch (error) {
    console.error("Error creating user:", error);
    throw new Error(`Failed to create user: ${error}`);
  }
}

/**
 * Update an existing user in the database
 */
export async function updateUser(
  userId: string,
  userData: UpdateUserData
): Promise<User> {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...userData,
        updatedAt: new Date(),
      },
    });

    console.log(`User updated successfully: ${user.id}`);
    return user;
  } catch (error) {
    console.error("Error updating user:", error);
    throw new Error(`Failed to update user: ${error}`);
  }
}

/**
 * Soft delete a user (set isDeleted to true)
 */
export async function deleteUser(userId: string): Promise<User> {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isDeleted: true,
        updatedAt: new Date(),
      },
    });

    console.log(`User soft deleted successfully: ${user.id}`);
    return user;
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new Error(`Failed to delete user: ${error}`);
  }
}

/**
 * Get a user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { 
        id: userId,
        isDeleted: false, // Only return non-deleted users
      },
    });

    return user;
  } catch (error) {
    console.error("Error fetching user:", error);
    throw new Error(`Failed to fetch user: ${error}`);
  }
}

/**
 * Get a user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const user = await prisma.user.findFirst({
      where: { 
        email: email,
        isDeleted: false, // Only return non-deleted users
      },
    });

    return user;
  } catch (error) {
    console.error("Error fetching user by email:", error);
    throw new Error(`Failed to fetch user by email: ${error}`);
  }
}

/**
 * Get all active users
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    const users = await prisma.user.findMany({
      where: {
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw new Error(`Failed to fetch users: ${error}`);
  }
}

/**
 * Check if a user exists
 */
export async function userExists(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { 
        id: userId,
        isDeleted: false,
      },
      select: { id: true }, // Only select ID for performance
    });

    return !!user;
  } catch (error) {
    console.error("Error checking user existence:", error);
    return false;
  }
}

/**
 * Sync user data from Clerk to database (upsert operation)
 */
export async function syncUserFromClerk(clerkUserData: {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  created_at: number;
  updated_at: number;
}): Promise<User> {
  const primaryEmail = clerkUserData.email_addresses.find(
    (email) => email.id === clerkUserData.email_addresses[0]?.id
  );

  try {
    const user = await prisma.user.upsert({
      where: { id: clerkUserData.id },
      update: {
        email: primaryEmail?.email_address || null,
        firstName: clerkUserData.first_name,
        lastName: clerkUserData.last_name,
        imageUrl: clerkUserData.image_url,
        updatedAt: new Date(clerkUserData.updated_at),
        isDeleted: false, // Ensure user is marked as active
      },
      create: {
        id: clerkUserData.id,
        email: primaryEmail?.email_address || null,
        firstName: clerkUserData.first_name,
        lastName: clerkUserData.last_name,
        imageUrl: clerkUserData.image_url,
        createdAt: new Date(clerkUserData.created_at),
        updatedAt: new Date(clerkUserData.updated_at),
        isDeleted: false,
      },
    });

    console.log(`User synced from Clerk: ${user.id}`);
    return user;
  } catch (error) {
    console.error("Error syncing user from Clerk:", error);
    throw new Error(`Failed to sync user from Clerk: ${error}`);
  }
}
