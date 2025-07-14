import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateThreadDto {
  @IsString()
  @IsOptional()
  currentSessionId?: string;

  @IsBoolean()
  @IsOptional()
  isLocked?: boolean;
}