import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsObject, IsString } from "class-validator";


export class SendToolResponseDto {
  @ApiProperty({
    description: 'The space name',
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
    description: 'The tool call id',
    example: '123',
  })
  @IsNotEmpty()
  @IsString()
  toolCallId: string;

  @ApiProperty({
    description: 'The response',
    example: {
      "success": true,
      "data": {
        "name": "John Doe",
        "age": 30,
        "email": "john.doe@example.com",
      },
    }
  })
  @IsObject()
  @IsNotEmpty()
  response: any;
}