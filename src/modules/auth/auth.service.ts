import { HttpService } from "@nestjs/axios";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { catchError, firstValueFrom } from "rxjs";
import * as jwt from 'jsonwebtoken';
import { AxiosError } from "axios";



@Injectable()
export class AuthService {
  constructor(private readonly httpService: HttpService) {}

  async exchangeToken(token: string) {
    const { data } = await firstValueFrom(
      this.httpService.get<any>(
        process.env.JARVIS_KIT_REMOTE_AUTH_API_ENDPOINT,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      ).pipe(
        catchError((error: AxiosError) => {
          throw new UnauthorizedException('Invalid token');
        }),
      ),
    );

    return this.generateToken(data, '7d');
  }

  async verifyToken(token: string) {
    try {
      return jwt.verify(token, process.env.JARVIS_KIT_JWT_SECRET);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /***
   * This is a placeholder for the actual revoke token logic
   * @param sourceToken - The source token to revoke all the exchanged tokens of the runtime
   * @returns true if the token is revoked, false otherwise
   * TODO: Implement the actual revoke token logic
   **/
  async revokeToken(sourceToken: string) {
    return true;
  }

  /***
   * This is a placeholder for the actual refresh token logic
   * @param token - The token to refresh
   * @returns the new token
   * TODO: Implement the actual refresh token logic
   **/
  async refreshToken(token: string) {
    return "new_token";
  }


  async generateToken(payload: any, expiresIn: string) {
    return jwt.sign(payload, process.env.JARVIS_KIT_JWT_SECRET, { expiresIn });
  }
}