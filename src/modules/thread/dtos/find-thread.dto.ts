import { ApiProperty } from "@nestjs/swagger";
import { PaginatedQuery } from "src/shared/dto";
import { IsOptional, IsString } from "class-validator";


export class FindThreadDto extends PaginatedQuery {
  @ApiProperty({
    description: 'The user id',
    example: '123',
  })
  @IsOptional()
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'The agent space',
    example: 'demo_agent_space',
  })
  @IsOptional()
  @IsString()
  namespace: string;

  @ApiProperty({
    description: 'The agent name',
    example: 'simple_agent',
  })
  @IsOptional()
  @IsString()
  agentName: string;
}