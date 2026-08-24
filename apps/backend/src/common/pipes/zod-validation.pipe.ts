import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => {
          const path = issue.path.join('.');

          return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
        })
        .join('; ');

      throw new BadRequestException(message);
    }

    return result.data;
  }
}
