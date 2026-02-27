import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  private clerkClient: ReturnType<typeof createClerkClient>;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
  ) {
    this.clerkClient = createClerkClient({
      secretKey: this.configService.get<string>('CLERK_SECRET_KEY'),
    });
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page = 1, pageSize = 20, ...filters } = params;
    const offset = (page - 1) * pageSize;

    return this.usersRepository.findAll({
      limit: pageSize,
      offset,
      ...filters,
    });
  }

  async findOne(id: string | number) {
    const user =
      typeof id === 'string'
        ? await this.usersRepository.findByClerkId(id)
        : await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByClerkId(clerkId: string) {
    return this.usersRepository.findByClerkId(clerkId);
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    currentUserId: string,
    currentUserRole: string,
  ) {
    // Get the user first
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent users from updating their own role
    if (user.clerkId === currentUserId && updateUserDto.role) {
      throw new ForbiddenException('You cannot change your own role');
    }

    // Only admins can change roles
    if (updateUserDto.role && currentUserRole !== 'admin') {
      throw new ForbiddenException('Only admins can change user roles');
    }

    // Update in database
    const updatedUser = await this.usersRepository.update(id, updateUserDto);

    // If role was updated, sync with Clerk
    if (updateUserDto.role && updatedUser) {
      await this.syncRoleToClerk(user.clerkId, updateUserDto.role);
    }

    return updatedUser;
  }

  private async syncRoleToClerk(clerkId: string, role: string) {
    try {
      // First, get the current user data from Clerk to preserve existing metadata
      const clerkUser = await this.clerkClient.users.getUser(clerkId);
      const currentMetadata = clerkUser.publicMetadata || {};

      // Get the database user to include userId
      const dbUser = await this.usersRepository.findByClerkId(clerkId);
      if (!dbUser) {
        throw new Error(`User not found in database with clerkId ${clerkId}`);
      }

      // Update only the role and userId, preserving other metadata
      await this.clerkClient.users.updateUser(clerkId, {
        publicMetadata: {
          ...currentMetadata,
          role,
          userId: dbUser.id,
        },
      });
      console.log(
        `Successfully synced role ${role} and userId ${dbUser.id} to Clerk for user ${clerkId}`,
      );
    } catch (error) {
      console.error(`Failed to sync role to Clerk for user ${clerkId}:`, error);
      // We don't throw here to avoid breaking the update flow
      // The database update has already happened
    }
  }

  async createUserFromClerk(userData: {
    clerkId: string;
    email: string;
    name: string | null;
    username: string | null;
    profileImageUrl: string | null;
    role?: string;
  }) {
    const newUser = await this.usersRepository.createFromClerk(userData);

    // Sync userId to Clerk metadata after creation
    if (newUser) {
      try {
        const clerkUser = await this.clerkClient.users.getUser(
          userData.clerkId,
        );
        const currentMetadata = clerkUser.publicMetadata || {};

        await this.clerkClient.users.updateUser(userData.clerkId, {
          publicMetadata: {
            ...currentMetadata,
            role: newUser.role,
            userId: newUser.id,
          },
        });
        console.log(
          `Synced userId ${newUser.id} to Clerk for new user ${userData.clerkId}`,
        );
      } catch (error) {
        console.error(
          `Failed to sync userId to Clerk for new user ${userData.clerkId}:`,
          error,
        );
      }
    }

    return newUser;
  }

  async updateUserFromClerk(userData: {
    clerkId: string;
    email?: string;
    name: string | null;
    username: string | null;
    profileImageUrl: string | null;
    role?: string;
  }) {
    return this.usersRepository.updateFromClerk(userData);
  }

  async deleteUserByClerkId(clerkId: string) {
    return this.usersRepository.deleteByClerkId(clerkId);
  }

  async getUserStats() {
    const allUsers = await this.usersRepository.findAll({ limit: 1000 }); // Get all users for stats

    const stats = {
      total: allUsers.totalItems,
      byRole: {} as Record<string, number>,
      activeLastMonth: 0,
      activeLastWeek: 0,
      activeToday: 0,
    };

    const now = new Date();
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    allUsers.items.forEach((user) => {
      // Count by role
      stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;

      // Count active users (based on creation date for now)
      if (user.createdAt) {
        const createdAt = new Date(user.createdAt);
        if (createdAt >= lastMonth) stats.activeLastMonth++;
        if (createdAt >= lastWeek) stats.activeLastWeek++;
        if (createdAt >= today) stats.activeToday++;
      }
    });

    return stats;
  }
}
