import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { DoctorsService } from '../doctors/doctors.service';

interface CheckSlotRequest {
  doctor_id: string;
  starts_at: string;
  ends_at: string;
}

interface CheckSlotResponse {
  available: boolean;
  reason: string;
}

@Controller()
export class AvailabilityGrpcController {
  constructor(private readonly doctors: DoctorsService) {}

  @GrpcMethod('DoctorAvailability', 'CheckSlot')
  async checkSlot(data: CheckSlotRequest): Promise<CheckSlotResponse> {
    const startsAt = new Date(data.starts_at);
    const endsAt = new Date(data.ends_at);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return { available: false, reason: 'invalid_datetime' };
    }

    const result = await this.doctors.checkSlotAvailability(data.doctor_id, startsAt, endsAt);
    return { available: result.available, reason: result.reason };
  }
}
