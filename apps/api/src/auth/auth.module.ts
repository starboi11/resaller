import { Module } from '@nestjs/common';
import { PasswordService } from './password.service.js';
import { SessionTokenService } from './session-token.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { SessionGuard } from './session.guard.js';
import { TotpService } from './totp.service.js';

@Module({ controllers: [AuthController], providers: [PasswordService, SessionTokenService, TotpService, AuthService, SessionGuard], exports: [PasswordService, SessionTokenService, AuthService, SessionGuard] })
export class AuthModule {}
