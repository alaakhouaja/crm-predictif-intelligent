import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { existsSync, unlinkSync } from 'fs';
import * as path from 'path';
import { UserRole } from '../common/enums/user-role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto, UpdateMeDto } from './dto/me.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12; // Augmenté pour une meilleure sécurité
  private readonly userSelect = {
    id: true,
    email: true,
    role: true,
    firstName: true,
    lastName: true,
    phone: true,
    createdAt: true,
    updatedAt: true,
    profilePhotoPath: true,
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async bootstrapAdmin(email: string, password: string) {
    const count = await this.prisma.user.count();
    if (count > 0) {
      throw new ConflictException('Bootstrap already completed');
    }
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: this.normalizeEmail(email),
        passwordHash,
        role: UserRole.ADMIN,
      },
      select: { id: true, email: true, role: true },
    });
    return this.signTokens(user.id, user.email);
  }

  /** Création d’un utilisateur par un admin — retourne le profil créé (pas de JWT du nouvel utilisateur). */
  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role ?? UserRole.SALES,
      },
      select: this.userSelect,
    });
    return this.toPublicUser(user);
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.signTokens(user.id, user.email);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userSelect,
    });
    return user ? this.toPublicUser(user) : null;
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      },
      select: this.userSelect,
    });
    return this.toPublicUser(user);
  }

  async uploadProfilePhoto(userId: string, file: Express.Multer.File) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profilePhotoPath: true },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhotoPath: file.path },
      select: this.userSelect,
    });

    if (existing.profilePhotoPath && existing.profilePhotoPath !== file.path) {
      this.safeDeleteProfilePhoto(existing.profilePhotoPath);
    }

    return this.toPublicUser(user);
  }

  async getProfilePhoto(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profilePhotoPath: true },
    });
    if (!user?.profilePhotoPath) {
      throw new NotFoundException('Profile photo not found');
    }
    return { storagePath: user.profilePhotoPath };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  private signTokens(userId: string, email: string) {
    const accessToken = this.jwt.sign({ sub: userId, email });
    return { accessToken, tokenType: 'Bearer' as const };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    role: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    createdAt: Date;
    updatedAt: Date;
    profilePhotoPath: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profilePhotoUrl: user.profilePhotoPath
        ? `/auth/me/photo?v=${user.updatedAt.getTime()}`
        : null,
    };
  }

  private safeDeleteProfilePhoto(storagePath: string) {
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const resolved = path.resolve(storagePath);
    if (!resolved.startsWith(uploadsRoot + path.sep) || !existsSync(resolved)) {
      return;
    }
    unlinkSync(resolved);
  }
}
