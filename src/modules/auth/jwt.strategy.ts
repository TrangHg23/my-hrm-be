import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET!,
      passReqToCallback: true as const,
    };
    super(options);
  }

  async validate(req: Request, payload: any) {
    const token = req.headers.authorization?.split(' ')[1];

    const isBlacklisted = await this.prisma.blacklistedToken.findUnique({
      where: { token },
    });

    if (isBlacklisted)
      throw new UnauthorizedException('Token has been invalidated');

    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
