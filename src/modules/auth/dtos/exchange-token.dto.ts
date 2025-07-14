import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";


export class ExchangeTokenDto {
  @ApiProperty({
    description: 'The token to exchange',
    example: 'a.b.c',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}