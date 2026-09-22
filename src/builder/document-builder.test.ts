import { describe, test, expect } from 'bun:test';
import 'reflect-metadata';
import { DocumentBuilder } from './document-builder';

describe('DocumentBuilder — document defaults', () => {
  test('produces OpenAPI 3.0.3 skeleton with empty collections', () => {
    const doc = new DocumentBuilder().build();
    expect(doc.openapi).toBe('3.0.3');
    expect(doc.info.version).toBe('1.0.0');
    expect(doc.paths).toEqual({});
    expect(doc.components?.schemas).toEqual({});
    expect(doc.components?.securitySchemes).toEqual({});
    expect(doc.tags).toEqual([]);
    expect(doc.servers).toEqual([]);
  });
});

describe('DocumentBuilder — info fields', () => {
  test('setTitle / setDescription / setVersion', () => {
    const doc = new DocumentBuilder()
      .setTitle('Orbit API')
      .setDescription('Orbit framework API reference')
      .setVersion('2.1.0')
      .build();

    expect(doc.info.title).toBe('Orbit API');
    expect(doc.info.description).toBe('Orbit framework API reference');
    expect(doc.info.version).toBe('2.1.0');
  });

  test('setTermsOfService, setContact, setLicense', () => {
    const doc = new DocumentBuilder()
      .setTermsOfService('https://example.com/terms')
      .setContact('Orbit Team', 'https://orbit.dev', 'team@orbit.dev')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .build();

    expect(doc.info.termsOfService).toBe('https://example.com/terms');
    expect(doc.info.contact).toEqual({
      name: 'Orbit Team',
      url: 'https://orbit.dev',
      email: 'team@orbit.dev',
    });
    expect(doc.info.license).toEqual({ name: 'MIT', url: 'https://opensource.org/licenses/MIT' });
  });
});

describe('DocumentBuilder — servers, tags, external docs', () => {
  test('addServer accumulates with description and variables', () => {
    const doc = new DocumentBuilder()
      .addServer('https://api.example.com')
      .addServer('https://staging.example.com', 'Staging', { region: { default: 'us-east' } })
      .build();

    expect(doc.servers).toHaveLength(2);
    expect(doc.servers?.[0]).toEqual({ url: 'https://api.example.com', description: undefined, variables: undefined });
    expect(doc.servers?.[1]).toEqual({
      url: 'https://staging.example.com',
      description: 'Staging',
      variables: { region: { default: 'us-east' } },
    });
  });

  test('addTag with description and externalDocs', () => {
    const doc = new DocumentBuilder()
      .addTag('users', 'User management')
      .addTag('admin', 'Admin ops', { description: 'Admin docs', url: 'https://orbit.dev/admin' })
      .build();

    expect(doc.tags).toEqual([
      { name: 'users', description: 'User management', externalDocs: undefined },
      { name: 'admin', description: 'Admin ops', externalDocs: { description: 'Admin docs', url: 'https://orbit.dev/admin' } },
    ]);
  });

  test('setExternalDoc', () => {
    const doc = new DocumentBuilder().setExternalDoc('Guide', 'https://orbit.dev/guide').build();
    expect(doc.externalDocs).toEqual({ description: 'Guide', url: 'https://orbit.dev/guide' });
  });
});

describe('DocumentBuilder — security schemes', () => {
  test('addBearerAuth defaults to JWT bearer under "bearer"', () => {
    const doc = new DocumentBuilder().addBearerAuth().build();
    expect(doc.components?.securitySchemes?.bearer).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  test('addBearerAuth with custom name and option overrides', () => {
    const doc = new DocumentBuilder()
      .addBearerAuth({ bearerFormat: 'opaque' }, 'session')
      .build();
    expect(doc.components?.securitySchemes?.session).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'opaque',
    });
  });

  test('addApiKey records name and location', () => {
    const doc = new DocumentBuilder()
      .addApiKey({ name: 'X-API-Key', in: 'header', description: 'Service key' }, 'serviceKey')
      .build();

    expect(doc.components?.securitySchemes?.serviceKey).toEqual({
      type: 'apiKey',
      name: 'X-API-Key',
      in: 'header',
      description: 'Service key',
    });
  });

  test('addBasicAuth', () => {
    const doc = new DocumentBuilder().addBasicAuth().build();
    expect(doc.components?.securitySchemes?.basic).toEqual({ type: 'http', scheme: 'basic' });
  });

  test('addOAuth2 stores flows and description', () => {
    const flows = {
      password: {
        tokenUrl: 'https://auth.example.com/token',
        scopes: { read: 'read access' },
      },
    };
    const doc = new DocumentBuilder().addOAuth2(flows, 'oauth2', 'Password flow').build();
    expect(doc.components?.securitySchemes?.oauth2).toEqual({
      type: 'oauth2',
      flows,
      description: 'Password flow',
    });
  });

  test('addSecurityRequirements accumulates entries with scopes', () => {
    const doc = new DocumentBuilder()
      .addSecurityRequirements('bearer')
      .addSecurityRequirements('oauth2', ['read', 'write'])
      .build();

    expect(doc.security).toEqual([
      { bearer: [] },
      { oauth2: ['read', 'write'] },
    ]);
  });
});

describe('DocumentBuilder — fluent chaining', () => {
  test('every setter returns the same builder instance', () => {
    const builder = new DocumentBuilder();
    const returned = builder
      .setTitle('t')
      .setDescription('d')
      .setVersion('v')
      .setTermsOfService('t')
      .setContact('n')
      .setLicense('l')
      .addServer('u')
      .setExternalDoc('e', 'u')
      .addTag('tag')
      .addBearerAuth()
      .addApiKey({ name: 'k', in: 'header' })
      .addBasicAuth()
      .addOAuth2({})
      .addSecurityRequirements('bearer');

    expect(returned).toBe(builder);
  });
});
