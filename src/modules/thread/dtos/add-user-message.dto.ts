import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";



export class AddUserMessageDto {
  @ApiProperty({
    description: 'The message content',
    example: 'Hello, how are you?',
  })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({
    description: 'The user id',
    example: '123',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'The agent space',
    example: 'demo_agent_space',
  })
  @IsNotEmpty()
  @IsString()
  namespace: string;

  @ApiProperty({
    description: 'The agent name',
    example: 'simple_agent',
  })
  @IsNotEmpty()
  @IsString()
  agentName: string;

  @ApiProperty({
    description: 'The agent config',
    example: {
      token: 'abc.def.ghi',
      model: 'gpt-4o-mini',
    },
  })
  @IsOptional()
  @IsObject()
  config: any;
}