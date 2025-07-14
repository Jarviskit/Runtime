import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { PaginationResult } from "../dto";
import { plainToInstance } from "class-transformer";

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const pageIndex = parseInt(request.query.pageIndex, 10) || 1;
    const pageSize = parseInt(request.query.pageSize, 10) || 10;

    return next.handle().pipe(
      map((data) => {
        const DTO: any = this.reflector.get<any>('serialize', context.getHandler());
        const isPaginated = DTO && Object.getPrototypeOf(DTO) === PaginationResult;

        if (isPaginated) {
          const { data: rawData, total } = data;
          return {
            success: true,
            data: rawData.map((item: any) => plainToInstance(DTO, item)),
            currentPageIndex: pageIndex,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
            totalRecords: total,
          }
        }

        if (typeof data === 'string') {
          return { success: true, data: data }
        }

        return {
          success: true,
          data: DTO ? plainToInstance(DTO, data) : data,
        }
      }),
    );
  }
}