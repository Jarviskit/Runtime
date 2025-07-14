import { Body,  Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ExchangeTokenDto } from "./dtos/exchange-token.dto";

@Controller('auth')
export class AuthController {

  constructor(private readonly authService: AuthService) {}

  @Post('exchange-token')
  async exchangeToken(@Body() body: ExchangeTokenDto) {
    return await this.authService.exchangeToken(body.token);
  }
}