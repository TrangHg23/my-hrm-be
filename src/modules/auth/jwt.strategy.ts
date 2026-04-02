import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: (req: Request) => req?.cookies?.['access_token'],
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const token = req?.cookies?.['access_token'];

    if (token) {
      const isBlacklisted = await this.prisma.blacklistedToken.findUnique({
        where: { token },
      });

      if (isBlacklisted)
        throw new UnauthorizedException('Token has been invalidated');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.role === 'EMPLOYEE' && user.isActive === false) {
      throw new UnauthorizedException('Your account has been deactivated.');
    }

    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
