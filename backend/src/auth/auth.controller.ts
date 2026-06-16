import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import * as path from 'path';
import type { Request, Response } from 'express';
import { UserRole } from '../common/enums/user-role.enum';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { Roles } from './decorators/roles.decorator';
import { BootstrapDto } from './dto/bootstrap.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto, UpdateMeDto } from './dto/me.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('bootstrap')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create first admin (only when database has no users)',
  })
  async bootstrap(
    @Body() dto: BootstrapDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.bootstrapAdmin(dto.email, dto.password);
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return tokens;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.login(dto);
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return tokens;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin crée un compte (JWT admin requis). Réponse = profil créé.',
  })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my profile (first/last name)' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.auth.updateMe(user.id, dto);
  }

  @Post('me/photo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const userId = ((req as Request).user as AuthUser | undefined)?.id ?? 'unknown';
          const dest = path.join(process.cwd(), 'uploads', 'profiles', userId);
          mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          const safeOriginal = file.originalname.replace(/[^\w.\- ]+/g, '_');
          cb(null, `${randomUUID()}_${safeOriginal}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = new Set([
          'image/png',
          'image/jpeg',
          'image/gif',
          'image/webp',
        ]);
        if (!allowed.has(file.mimetype)) {
          (req as Request & { fileValidationError?: string }).fileValidationError =
            'Type de fichier non supporté';
          cb(null, false);
          return;
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload my profile photo' })
  uploadMePhoto(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const err = (req as Request & { fileValidationError?: string }).fileValidationError;
    if (err) {
      throw new BadRequestException(err);
    }
    if (!file) {
      throw new BadRequestException('Aucune image reçue');
    }
    return this.auth.uploadProfilePhoto(user.id, file);
  }

  @Get('me/photo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my profile photo' })
  async getMePhoto(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const photo = await this.auth.getProfilePhoto(user.id);
    const resolved = path.resolve(photo.storagePath);
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    // Normalize separators before comparison (Windows compatibility)
    const normalizedResolved = resolved.replace(/\\/g, '/');
    const normalizedUploadsRoot = uploadsRoot.replace(/\\/g, '/');
    if (!normalizedResolved.startsWith(normalizedUploadsRoot + '/')) {
      throw new BadRequestException('Chemin de photo invalide');
    }
    res.sendFile(resolved, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ message: 'Erreur lors de l\'envoi du fichier' });
      }
    });
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change my password' })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.id, dto);
  }
}
