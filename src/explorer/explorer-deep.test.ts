import { describe, test, expect } from 'bun:test';
import 'reflect-metadata';
import { SwaggerExplorer } from './swagger-explorer';
import { DocumentBuilder } from '../builder/document-builder';
import { Controller, Get, Post } from '@galaxy-stack/orbit-core';
import {
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiTags,
  ApiBearerAuth,
  ApiSecurity,
  ApiExcludeEndpoint,
  ApiExcludeController,
  ApiProperty,
  ApiPropertyOptional,
} from '../decorators/api.decorators';

class CreateUserDto {
  @ApiProperty({ description: 'User email', example: 'a@b.c' })
  email!: string;

  @ApiProperty({ minimum: 1, maximum: 120, type: Number })
  age!: number;

  @ApiPropertyOptional()
  nickname?: string;

  @ApiProperty({ required: false, nullable: true })
  bio?: string | null;

  @ApiProperty({ enum: ['admin', 'user'], default: 'user' })
  role!: string;

  @ApiProperty({ isArray: true, type: Number })
  scores!: number[];
}

function baseDoc() {
  return new DocumentBuilder().setTitle('Test API').build();
}

describe('SwaggerExplorer — parameter type mapping', () => {
  const explorer = new SwaggerExplorer();

  test('String / Number / Boolean / Date parameter types', () => {
    @Controller('params')
    class ParamController {
      @Get()
      @ApiParam({ name: 'limit', in: 'query', type: String })
      @ApiParam({ name: 'page', in: 'query', type: Number })
      @ApiParam({ name: 'verbose', in: 'query', type: Boolean })
      @ApiParam({ name: 'since', in: 'query', type: Date })
      list() {}
    }
    const doc = explorer.exploreControllers([ParamController as any], baseDoc());
    const params = (doc.paths['/params'] as any)?.get?.parameters;
    const byName = Object.fromEntries(params.map((p: any) => [p.name, p.schema]));
    expect(byName.limit).toEqual({ type: 'string' });
    expect(byName.page).toEqual({ type: 'number' });
    expect(byName.verbose).toEqual({ type: 'boolean' });
    expect(byName.since).toEqual({ type: 'string', format: 'date-time' });
  });

  test('array-typed parameter becomes array schema', () => {
    @Controller('arrays')
    class ArrController {
      @Get()
      @ApiQuery({ name: 'ids', type: [String] })
      list() {}
    }
    const doc = explorer.exploreControllers([ArrController as any], baseDoc());
    const param = (doc.paths['/arrays'] as any)?.get?.parameters?.[0];
    expect(param.schema).toEqual({ type: 'array', items: { type: 'string' } });
  });

  test('enum parameter produces enum schema', () => {
    @Controller('enums')
    class EnumController {
      @Get()
      @ApiParam({ name: 'role', in: 'query', enum: ['admin', 'user'] })
      list() {}
    }
    const doc = explorer.exploreControllers([EnumController as any], baseDoc());
    const param = (doc.paths['/enums'] as any)?.get?.parameters?.[0];
    expect(param.schema).toEqual({ type: 'string', enum: ['admin', 'user'] });
  });

  test('path params default to in=path + required, query params to optional', () => {
    @Controller('mixed-params')
    class MixedParamController {
      @Get(':id')
      @ApiParam({ name: 'id', type: String })
      @ApiQuery({ name: 'expand', type: String })
      get() {}
    }
    const doc = explorer.exploreControllers([MixedParamController as any], baseDoc());
    const params = (doc.paths['/mixed-params/:id'] as any)?.get?.parameters;
    const byName = Object.fromEntries(params.map((p: any) => [p.name, p]));
    expect(byName.id.in).toBe('path');
    expect(byName.id.required).toBe(true);
    expect(byName.expand.in).toBe('query');
    expect(byName.expand.required).toBe(false);
  });

  test('ApiParam example reaches the parameter', () => {
    @Controller('examples')
    class ExampleController {
      @Get()
      @ApiQuery({ name: 'q', type: String, example: 'orbit' })
      search() {}
    }
    const doc = explorer.exploreControllers([ExampleController as any], baseDoc());
    const param = (doc.paths['/examples'] as any)?.get?.parameters?.[0];
    expect(param.example).toBe('orbit');
  });
});

describe('SwaggerExplorer — class schemas via ApiProperty', () => {
  const explorer = new SwaggerExplorer();

  test('response type registers a $ref schema with properties', () => {
    @Controller('users')
    class UserController {
      @Get(':id')
      @ApiResponse({ status: 200, type: CreateUserDto })
      get() {}
    }
    const doc = explorer.exploreControllers([UserController as any], baseDoc());
    const schema = doc.components?.schemas?.CreateUserDto as any;
    expect(schema).toBeDefined();
    expect(schema.type).toBe('object');
    expect(schema.properties.email).toMatchObject({ type: 'string', description: 'User email', example: 'a@b.c' });
    expect(schema.properties.age).toMatchObject({ minimum: 1, maximum: 120 });
    expect(schema.required).toContain('email');
    expect(schema.required).toContain('age');
    // ApiPropertyOptional => not required
    expect(schema.required).not.toContain('nickname');
    // required:false + nullable
    expect(schema.properties.bio.nullable).toBe(true);
    // enum + default
    expect(schema.properties.role).toMatchObject({ enum: ['admin', 'user'], default: 'user' });
    // isArray wraps in array schema
    expect(schema.properties.scores).toEqual({ type: 'array', items: { type: 'number' } });
  });

  test('repeated class type reuses $ref without duplicating schema', () => {
    @Controller('twos')
    class TwoController {
      @Get('a') @ApiResponse({ status: 200, type: CreateUserDto }) one() {}
      @Get('b') @ApiResponse({ status: 200, type: CreateUserDto }) two() {}
    }
    explorer.exploreControllers([TwoController as any], new DocumentBuilder().build());
    const count = [...explorer['schemas'].keys()].filter(k => k === 'CreateUserDto').length;
    expect(count).toBe(1);
  });
});

describe('SwaggerExplorer — responses', () => {
  const explorer = new SwaggerExplorer();

  test('no explicit responses yields default 200', () => {
    @Controller('plains')
    class PlainController {
      @Get() plain() {}
    }
    const doc = explorer.exploreControllers([PlainController as any], baseDoc());
    const responses = (doc.paths['/plains'] as any)?.get?.responses;
    expect(responses['200']).toEqual({ description: 'Successful operation' });
  });

  test('status-specific responses with helper decorators', () => {
    @Controller('resps')
    class RespController {
      @Post()
      @ApiCreatedResponse({ description: 'User created', type: CreateUserDto })
      @ApiBadRequestResponse({ description: 'Validation failed' })
      @ApiOkResponse({ description: 'Fallback ok' })
      create() {}
    }
    const doc = explorer.exploreControllers([RespController as any], baseDoc());
    const responses = (doc.paths['/resps'] as any)?.post?.responses;

    expect(responses['201'].description).toBe('User created');
    expect(responses['201'].content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/CreateUserDto',
    });
    expect(responses['400'].description).toBe('Validation failed');
    expect(responses['200'].description).toBe('Fallback ok');
  });

  test('isArray response wraps schema in array', () => {
    @Controller('lists')
    class ListController {
      @Get()
      @ApiResponse({ status: 200, type: CreateUserDto, isArray: true })
      list() {}
    }
    const doc = explorer.exploreControllers([ListController as any], baseDoc());
    const schema = (doc.paths['/lists'] as any)?.get?.responses?.['200']?.content?.['application/json']?.schema;
    expect(schema).toEqual({ type: 'array', items: { $ref: '#/components/schemas/CreateUserDto' } });
  });
});

describe('SwaggerExplorer — request body', () => {
  const explorer = new SwaggerExplorer();

  test('ApiBody with type produces JSON content and required by default', () => {
    @Controller('bodies')
    class BodyController {
      @Post()
      @ApiBody({ type: CreateUserDto })
      create() {}
    }
    const doc = explorer.exploreControllers([BodyController as any], baseDoc());
    const requestBody = (doc.paths['/bodies'] as any)?.post?.requestBody;
    expect(requestBody.required).toBe(true);
    expect(requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/CreateUserDto',
    });
  });

  test('ApiBody with isArray and custom required', () => {
    @Controller('bulk')
    class ArrayBodyController {
      @Post()
      @ApiBody({ type: Number, isArray: true, required: false })
      bulk() {}
    }
    const doc = explorer.exploreControllers([ArrayBodyController as any], baseDoc());
    const requestBody = (doc.paths['/bulk'] as any)?.post?.requestBody;
    expect(requestBody.required).toBe(false);
    expect(requestBody.content['application/json'].schema).toEqual({
      type: 'array',
      items: { type: 'number' },
    });
  });
});

describe('SwaggerExplorer — operation metadata', () => {
  const explorer = new SwaggerExplorer();

  test('ApiOperation summary/description/deprecated reach the operation', () => {
    @Controller('ops')
    class OpController {
      @Get()
      @ApiOperation({ summary: 'List all', description: 'Full listing', deprecated: true })
      list() {}
    }
    const op = (explorer.exploreControllers([OpController as any], baseDoc()).paths['/ops'] as any).get;
    expect(op.summary).toBe('List all');
    expect(op.description).toBe('Full listing');
    expect(op.deprecated).toBe(true);
  });

  test('operationId defaults to Controller_method', () => {
    @Controller('ids')
    class IdController {
      @Get() named() {}
    }
    const op = (explorer.exploreControllers([IdController as any], baseDoc()).paths['/ids'] as any).get;
    expect(op.operationId).toBe('IdController_named');
  });

  test('method tags override controller tags', () => {
    @Controller('tagged')
    @ApiTags('controller-tag')
    class TagController {
      @Get()
      @ApiTags('override-tag')
      list() {}
    }
    const op = (explorer.exploreControllers([TagController as any], baseDoc()).paths['/tagged'] as any).get;
    expect(op.tags).toEqual(['override-tag']);
  });

  test('controller without ApiTags derives tag from class name', () => {
    @Controller('plain-tags')
    class BillingController {
      @Get() list() {}
    }
    const op = (explorer.exploreControllers([BillingController as any], baseDoc()).paths['/plain-tags'] as any).get;
    expect(op.tags).toEqual(['Billing']);
  });
});

describe('SwaggerExplorer — security', () => {
  const explorer = new SwaggerExplorer();

  test('controller-level ApiBearerAuth applies to all operations', () => {
    @Controller('secure')
    @ApiBearerAuth()
    class SecureController {
      @Get() list() {}
      @Post() create() {}
    }
    const doc = explorer.exploreControllers([SecureController as any],
      new DocumentBuilder().addBearerAuth().build());
    expect((doc.paths['/secure'] as any).get.security).toEqual([{ bearer: [] }]);
    expect((doc.paths['/secure'] as any).post.security).toEqual([{ bearer: [] }]);
  });

  test('method-level ApiSecurity overrides controller security', () => {
    @Controller('mixed')
    class MixedController {
      @Get()
      @ApiSecurity('api_key')
      keyOnly() {}
    }
    const doc = explorer.exploreControllers([MixedController as any],
      new DocumentBuilder().addApiKey({ name: 'k', in: 'header' }, 'api_key').build());
    const op = (doc.paths['/mixed'] as any).get;
    expect(op.security).toEqual([{ api_key: [] }]);
  });
});

describe('SwaggerExplorer — exclusion', () => {
  const explorer = new SwaggerExplorer();

  test('ApiExcludeController removes the whole controller', () => {
    @ApiExcludeController()
    @Controller('secret')
    class SecretController {
      @Get() list() {}
    }
    const doc = explorer.exploreControllers([SecretController as any], baseDoc());
    expect(doc.paths['/secret']).toBeUndefined();
  });

  test('ApiExcludeEndpoint removes a single method', () => {
    @Controller('partial')
    class PartialController {
      @Get() public() {}
      @Get('hidden')
      @ApiExcludeEndpoint()
      hidden() {}
    }
    const doc = explorer.exploreControllers([PartialController as any], baseDoc());
    expect(Object.keys((doc.paths['/partial'] as any))).toEqual(['get']);
  });

  test('methods without route metadata are skipped', () => {
    @Controller('mixed')
    class Mixed {
      @Get() routed() {}
      helperMethod() {}
    }
    const doc = explorer.exploreControllers([Mixed as any], baseDoc());
    expect(Object.keys((doc.paths['/mixed'] as any))).toEqual(['get']);
  });
});

describe('SwaggerExplorer — path normalization', () => {
  const explorer = new SwaggerExplorer();

  test('collapses duplicate slashes and empty segments', () => {
    @Controller('/')
    class RootController {
      @Get('items/:id')
      item() {}

      @Get()
      root() {}
    }
    const doc = explorer.exploreControllers([RootController as any], baseDoc());
    const paths = Object.keys(doc.paths);
    expect(paths).toContain('/items/:id');
    expect(paths).toContain('/');
  });
});
