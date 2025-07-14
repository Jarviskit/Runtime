import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";



export class CreateThreadDto {
  @ApiProperty({
    description: 'The user id',
    example: '123',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'The conversation name',
    example: 'My Conversation',
  })
  @IsOptional()
  @IsString()
  name: string;
}