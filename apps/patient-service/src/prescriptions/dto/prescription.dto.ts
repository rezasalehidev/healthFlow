import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export enum PrescriptionStatusDto {
  ACTIVE = 'ACTIVE',
  FULFILLED = 'FULFILLED',
  CANCELLED = 'CANCELLED',
}

export class CreatePrescriptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  medication!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  dosage!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;
}

export class UpdatePrescriptionStatusDto {
  @IsEnum(PrescriptionStatusDto)
  status!: PrescriptionStatusDto;
}
