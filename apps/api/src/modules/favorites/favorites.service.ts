import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async getFavoriteRoutes(userId: string) {
    return this.prisma.favoriteRoute.findMany({
      where: { userId },
      include: {
        route: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeFavoriteRoute(id: string, userId: string) {
    const favorite = await this.prisma.favoriteRoute.findFirst({
      where: { id, userId },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    await this.prisma.favoriteRoute.delete({ where: { id } });
    return { message: 'Favorite removed successfully' };
  }

  async getFavoritePlaces(userId: string) {
    return this.prisma.favoritePlace.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeFavoritePlace(id: string, userId: string) {
    const favorite = await this.prisma.favoritePlace.findFirst({
      where: { id, userId },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    await this.prisma.favoritePlace.delete({ where: { id } });
    return { message: 'Favorite removed successfully' };
  }
}
