import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateCrewCapacityDto {
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(1440)
  dailyCapacityMinutes!: number | null;
}
