import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RouteStatus } from '@prisma/client';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) { }

  async getHistory(userId: string, page?: string, limit?: string) {
    const page_num = parseInt(page || '1', 10);
    const limit_num = parseInt(limit || '20', 10);
    const skip = (page_num - 1) * limit_num;

    const [routes, total] = await Promise.all([
      this.prisma.route.findMany({
        where: { userId },
        skip,
        take: limit_num,
        orderBy: [{ id: 'desc' }],
        include: { vehicle: true },
      }),
      this.prisma.route.count({ where: { userId } }),
    ]);

    return {
      data: routes,
      meta: {
        total,
        page: page_num,
        lastPage: Math.ceil(total / limit_num),
      },
    };
  }

  async getRouteDetail(id: string, userId: string) {
    const route = await this.prisma.route.findFirst({
      where: { id, userId },
      include: { vehicle: true },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    return route;
  }

  async deleteRoute(id: string, userId: string) {
    const route = await this.getRouteDetail(id, userId);

    // FavoriteRoute is now deleted automatically via Prisma Cascade onDelete
    await this.prisma.route.delete({ where: { id } });

    return { message: 'Route deleted successfully' };
  }

  async addFavoriteRoute(userId: string, routeId: string, name?: string) {
    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    // Check if already favorited
    const existing = await this.prisma.favoriteRoute.findFirst({
      where: { userId, routeId },
    });

    if (existing) {
      throw new BadRequestException('Route already in favorites');
    }

    return this.prisma.favoriteRoute.create({
      data: {
        userId,
        routeId,
        name: name || `Favorite: ${route.origin} ? ${route.destination}`,
      },
      include: { route: true },
    });
  }
}
