import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { PaginatedQuery } from "src/shared/dto";


export class GetThreadMessagesDto extends PaginatedQuery {
  @ApiProperty({
    description: 'The id of the thread',
    example: '123',
  })
  @IsString()
  @IsNotEmpty()
  threadId: string;
}