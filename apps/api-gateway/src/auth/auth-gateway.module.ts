import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthProxyController } from './auth-proxy.controller';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AppointmentsProxyController } from '../appointments/appointments-proxy.controller';
import { DoctorsProxyController } from '../doctors/doctors-proxy.controller';
import { PatientsProxyController } from '../patients/patients-proxy.controller';
import { ProxyModule } from '../proxy/proxy.module';

@Module({
  imports: [
    ProxyModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [
    AuthProxyController,
    DoctorsProxyController,
    PatientsProxyController,
    AppointmentsProxyController,
  ],
  providers: [JwtStrategy, RolesGuard, PermissionsGuard],
})
export class AuthGatewayModule {}
