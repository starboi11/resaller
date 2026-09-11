import { Module } from '@nestjs/common';
import { CommerceController } from './commerce.controller.js';
import { CommerceService } from './commerce.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({ imports: [AuthModule], controllers: [CommerceController], providers: [CommerceService] })
export class CommerceModule {}
