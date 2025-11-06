"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { UserSheet } from "@/components/user-sheet";

// User type matching Supabase response (snake_case)
interface User {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  image_url: string | null;
  profile_image_url: string | null;
  banned: boolean;
  locked: boolean;
  two_factor_enabled: boolean;
  totp_enabled: boolean;
  last_active_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

export function AdminUsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(25);
  const [showAll, setShowAll] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/users");
        
        if (!response.ok) {
          if (response.status === 403) {
            setError("Access denied. Admin privileges required.");
          } else if (response.status === 401) {
            setError("Unauthorized. Please sign in.");
          } else {
            setError("Failed to fetch users");
          }
          return;
        }

        const data = await response.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Calculate pagination - moved before conditional returns to follow Rules of Hooks
  const totalUsers = users.length;
  const effectivePageSize = showAll || pageSize === "all" ? totalUsers : pageSize;
  const totalPages = effectivePageSize === totalUsers ? 1 : Math.ceil(totalUsers / effectivePageSize);
  
  const displayedUsers = useMemo(() => {
    if (showAll || pageSize === "all") {
      return users;
    }
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return users.slice(startIndex, endIndex);
  }, [users, currentPage, pageSize, showAll]);

  // Reset to first page when page size changes
  useEffect(() => {
    if (!showAll && pageSize !== "all") {
      const maxPage = Math.ceil(totalUsers / pageSize);
      if (currentPage > maxPage) {
        setCurrentPage(1);
      }
    }
  }, [pageSize, totalUsers, showAll, currentPage]);

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const getUserDisplayName = (user: User) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ""} ${user.last_name || ""}`.trim();
    }
    if (user.username) {
      return user.username;
    }
    if (user.email) {
      return user.email.split("@")[0];
    }
    return "User";
  };

  const getUserInitials = (user: User) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() || "U";
    }
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const handlePageSizeChange = (value: string) => {
    if (value === "all") {
      setPageSize("all");
      setShowAll(true);
      setCurrentPage(1);
    } else {
      setPageSize(Number(value));
      setShowAll(false);
      setCurrentPage(1);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                Total users: {totalUsers}
                {!showAll && pageSize !== "all" && (
                  <> • Showing {displayedUsers.length} of {totalUsers} (Page {currentPage} of {totalPages})</>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <Select
                value={showAll ? "all" : String(pageSize)}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                  <SelectItem value="all">Show all</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Banned</TableHead>
                <TableHead>Locked</TableHead>
                <TableHead>2FA</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                displayedUsers.map((user) => (
                  <TableRow 
                    key={user.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedUser(user);
                      setSheetOpen(true);
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={user.image_url || user.profile_image_url || undefined}
                            alt={getUserDisplayName(user)}
                          />
                          <AvatarFallback>
                            {getUserInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm truncate">
                            {getUserDisplayName(user)}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {user.email || "No email"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{user.username || "N/A"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground truncate block max-w-[120px]">
                        {user.id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          user.banned
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {user.banned ? "Yes" : "No"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          user.locked
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {user.locked ? "Yes" : "No"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          user.two_factor_enabled || user.totp_enabled
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {user.two_factor_enabled || user.totp_enabled ? "Yes" : "No"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(user.last_active_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(user.last_sign_in_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Pagination Controls */}
          {!showAll && pageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * (pageSize as number)) + 1} to {Math.min(currentPage * (pageSize as number), totalUsers)} of {totalUsers} users
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) {
                          setCurrentPage((prev) => prev - 1);
                        }
                      }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {getPageNumbers().map((page, index) => (
                    <PaginationItem key={index}>
                      {page === "ellipsis" ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(page);
                          }}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) {
                          setCurrentPage((prev) => prev + 1);
                        }
                      }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      <UserSheet
        user={selectedUser}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

