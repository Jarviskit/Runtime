import { ApiProperty } from "@nestjs/swagger";
import { PaginationResult } from "src/shared/dto";

export class ThreadResponseDto extends PaginationResult {
  @ApiProperty({
    description: 'The thread id',
    example: '123',
  })
  id: string;

  @ApiProperty({
    description: 'The thread title',
    example: 'My thread',
  })
  name: string;
}