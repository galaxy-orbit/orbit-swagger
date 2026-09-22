import { describe, test, expect } from 'bun:test';
import 'reflect-metadata';
import { DocumentBuilder } from './builder/document-builder';
import { SwaggerExplorer } from './explorer/swagger-explorer';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint, ApiBearerAuth, ApiProperty } from './decorators/api.decorators';
import { Controller, Get, Post, Injectable } from '@galaxy-stack/orbit-core';

describe('DocumentBuilder', () => {
  test('fluent API assembles a valid OpenAPI document', () => {
    const doc = new DocumentBuilder()
      .setTitle('Orbit API')
      .setDescription('The Orbit framework API')
      .setVersion('0.1.0')
      .setContact('Galaxy', 'https://galaxy.dev', 'hi@galaxy.dev')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addServer('https://api.orbit.dev', 'Production')
      .addServer('http://localhost:3000', 'Development')
      .addTag('users', 'User management')
      .setExternalDoc('Guides', 'https://docs.orbit.dev')
      .build();

    expect(doc.openapi).toBe('3.0.3');
    expect(doc.info.title).toBe('Orbit API');
    expect(doc.info.version).toBe('0.1.0');
    expect(doc.servers).toHaveLength(2);
    expect(doc.tags![0].name).toBe('users');
    expect(doc.externalDocs!.url).toBe('https://docs.orbit.dev');
  });

  test('addBearerAuth registers a bearer security scheme', () => {
    const doc = new DocumentBuilder().addBearerAuth().build();
    expect(doc.components!.securitySchemes!.bearer).toMatchObject({ type: 'http', scheme: 'bearer' });
  });
});

describe('SwaggerExplorer (with real Orbit decorators)', () => {
  const { ApiExcludeEndpoint } = require('./decorators/api.decorators');

  @Controller('/users')
  @ApiTags('users')
  class UsersController {
    @Get('/')
    @ApiOperation({ summary: 'List users' })
    @ApiResponse({ status: 200, description: 'The list of users' })
    list() {}

    @Get('/hidden')
    @ApiExcludeEndpoint()
    hidden() {}

    @Post('/')
    @ApiOperation({ summary: 'Create user' })
    create() {}
  }

  test('builds paths from decorated Orbit controllers', () => {
    const base = { openapi: '3.0.3', info: { title: 'T', version: '1' }, tags: [], servers: [] } as any;
    const doc = new SwaggerExplorer().exploreControllers([UsersController], base as any);
    const paths = Object.keys(doc.paths);
    expect(paths).toContain('/users');
    expect(doc.paths['/users'].get).toBeDefined();
    expect(doc.paths['/users'].post).toBeDefined();
  });

  test('excluded methods are skipped', () => {
    const base = { openapi: '3.0.3', info: { title: 'T', version: '1' }, tags: [], servers: [] } as any;
    const doc = new SwaggerExplorer().exploreControllers([UsersController], base as any);
    expect(doc.paths['/users/hidden']).toBeUndefined();
  });

  test('controller tags apply to operations', () => {
    const base = { openapi: '3.0.3', info: { title: 'T', version: '1' }, tags: [] } as any;
    const doc = new SwaggerExplorer().exploreControllers([UsersController], base as any);
    const get = doc.paths['/users'].get as any;
    expect(get.tags).toContain('users');
    expect(get.operationId).toBe('UsersController_list');
  });
});

describe('ApiProperty schema generation', () => {
  test('registers schema property metadata', () => {
    class CreateUserDto {
      @ApiProperty({ type: 'string' })
      name: string = '';

      @ApiProperty({ type: 'number', required: false })
      age: number = 0;
    }
    const props = Reflect.getMetadata('swagger:property', CreateUserDto) as Map<string, any>;
    expect(props).toBeDefined();
    expect(props.get('name').type).toBe('string');
    expect(props.get('age').required).toBe(false);
  });
});
