import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { HttpExceptionFilter } from './filters/http-exception.filter.js';

const flattenValidationErrors = (errors: ValidationError[]): string[] =>
  errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flattenValidationErrors(error.children ?? []),
  ]);

export const configureApp = (app: INestApplication): void => {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({ errors: flattenValidationErrors(errors) }),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
};