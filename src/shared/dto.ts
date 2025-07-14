import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsOptional, Min, Max } from "class-validator";

export class PaginatedQuery {
  @ApiProperty({
    description: 'The page number',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page: number = 1;

  @ApiProperty({
    description: 'The number of items per page',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit: number = 10;
}


export class PaginationResult { }