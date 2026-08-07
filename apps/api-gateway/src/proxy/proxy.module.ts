import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyService } from './proxy.service';

@Module({
  imports: [
    HttpModule.register({
      maxRedirects: 0,
    }),
  ],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
