# @galaxy-stack/orbit-swagger

[![npm version](https://img.shields.io/npm/v/@galaxy-stack/orbit-swagger.svg)](https://www.npmjs.com/package/@galaxy-stack/orbit-swagger)
[![docs](https://img.shields.io/badge/docs-galaxy--orbit--framework.vercel.app-blue)](https://galaxy-orbit-framework.vercel.app)

Part of the [Orbit framework](https://github.com/galaxy-orbit/packages) — a NestJS-style backend framework for [Bun](https://bun.sh).

## Installation

```bash
bun add @galaxy-stack/orbit-swagger
```

# @galaxy-stack/orbit-swagger

## Mô tả
Module tạo tài liệu API tự động với OpenAPI 3.0/Swagger cho Orbit.

## Tính năng chính

### 1. DocumentBuilder
Tạo cấu hình OpenAPI spec:

```typescript
import { DocumentBuilder, SwaggerModule } from '@galaxy-stack/orbit-swagger';

const config = new DocumentBuilder()
  .setTitle('My API')
  .setDescription('API Description')
  .setVersion('1.0.0')
  .addServer('http://localhost:3000')
  .addBearerAuth()
  .addTag('users', 'User operations')
  .build();
```

### 2. API Decorators

```typescript
import { 
  ApiTags, ApiOperation, ApiResponse,
  ApiParam, ApiQuery, ApiBody,
  ApiBearerAuth, ApiProperty
} from '@galaxy-stack/orbit-swagger';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
class UserController {
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'User found', type: UserDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUser(@Param('id') id: number) {}
}
```

### 3. DTO Decorators

```typescript
class CreateUserDto {
  @ApiProperty({ description: 'User name', example: 'John' })
  name!: string;

  @ApiProperty({ description: 'Email', required: false })
  email?: string;

  @ApiProperty({ enum: ['admin', 'user'], default: 'user' })
  role!: string;
}
```

### 4. Response Helpers

```typescript
@ApiOkResponse({ type: User })
@ApiCreatedResponse({ type: User })
@ApiBadRequestResponse()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@ApiNotFoundResponse()
```

## Cách sử dụng

```typescript
import { SwaggerModule, DocumentBuilder } from '@galaxy-stack/orbit-swagger';

const app = await BunFactory.create(AppModule);

const config = new DocumentBuilder()
  .setTitle('My API')
  .setVersion('1.0')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api-docs', app, document);

await app.listen(3000);
// Swagger UI tại: http://localhost:3000/api-docs
// JSON spec tại: http://localhost:3000/api-docs/json
```

## Exclude Endpoints

```typescript
@ApiExcludeController()  // Ẩn toàn bộ controller
class InternalController {}

@ApiExcludeEndpoint()  // Ẩn 1 endpoint
@Get('internal')
internalMethod() {}
```

## Output
Swagger UI tự động được generate với:
- Danh sách tất cả endpoints
- Request/Response schemas
- Try it out functionality
- Authentication support
