import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMedicalRecordDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  notes!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  diagnosisCode?: string;
}

export class UpdateMedicalRecordDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  diagnosisCode?: string;
}
