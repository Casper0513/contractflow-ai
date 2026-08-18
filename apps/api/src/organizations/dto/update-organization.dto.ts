import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  legalName?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== '')
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== '')
  @IsString()
  @MaxLength(40)
  @Matches(/^[0-9()+\-\s.]+$/, {
    message: 'phone contains invalid characters',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== '')
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxNumber?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== '')
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @MaxLength(255)
  website?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== '')
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsIn(['CAD', 'USD'])
  currency?: 'CAD' | 'USD';
}
