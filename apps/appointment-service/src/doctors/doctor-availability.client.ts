import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { join } from 'node:path';
import { firstValueFrom, Observable } from 'rxjs';
import { AppException, ErrorCode } from '@healthflow/common';

interface CheckSlotRequest {
  doctor_id: string;
  starts_at: string;
  ends_at: string;
}

interface CheckSlotResponse {
  available: boolean;
  reason: string;
}

interface DoctorAvailabilityClient {
  CheckSlot(data: CheckSlotRequest): Observable<CheckSlotResponse>;
}

/**
 * gRPC client for doctor availability — preferred over REST for internal typed RPCs.
 */
@Injectable()
export class DoctorAvailabilityClientService implements OnModuleInit {
  private readonly logger = new Logger(DoctorAvailabilityClientService.name);
  private client!: DoctorAvailabilityClient;
  private grpc!: ClientGrpc;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('DOCTOR_GRPC_URL', 'localhost:50051');
    const protoPath = join(process.cwd(), 'proto/doctor/v1/availability.proto');

    this.grpc = ClientProxyFactory.create({
      transport: Transport.GRPC,
      options: {
        package: 'healthflow.doctor.v1',
        protoPath,
        url,
      },
    });

    this.client = this.grpc.getService<DoctorAvailabilityClient>('DoctorAvailability');
  }

  async checkSlot(
    doctorId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<{ available: boolean; reason: string }> {
    try {
      const response = await firstValueFrom(
        this.client.CheckSlot({
          doctor_id: doctorId,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
        }),
      );
      return { available: response.available, reason: response.reason };
    } catch (error: unknown) {
      this.logger.error({
        message: 'Doctor availability gRPC call failed',
        error: error instanceof Error ? error.message : error,
      });
      throw new AppException(
        ErrorCode.INTERNAL_ERROR,
        'Doctor availability service unavailable',
        503,
      );
    }
  }
}
