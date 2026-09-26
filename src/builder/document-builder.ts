import type { 
  OpenAPIDocument, 
  OpenAPIInfo, 
  OpenAPIServer, 
  OpenAPITag, 
  OpenAPISecurityScheme,
  OpenAPIExternalDocs 
} from '../interfaces/swagger.interface';

export class DocumentBuilder {
  private readonly document: Partial<OpenAPIDocument> = {
    openapi: '3.0.3',
    info: {
      title: '',
      version: '1.0.0',
    },
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {},
    },
    tags: [],
    servers: [],
  };

  setTitle(title: string): this {
    this.document.info!.title = title;
    return this;
  }

  setDescription(description: string): this {
    this.document.info!.description = description;
    return this;
  }

  setVersion(version: string): this {
    this.document.info!.version = version;
    return this;
  }

  setTermsOfService(termsOfService: string): this {
    this.document.info!.termsOfService = termsOfService;
    return this;
  }

  setContact(name: string, url?: string, email?: string): this {
    this.document.info!.contact = { name, url, email };
    return this;
  }

  setLicense(name: string, url?: string): this {
    this.document.info!.license = { name, url };
    return this;
  }

  addServer(url: string, description?: string, variables?: Record<string, any>): this {
    this.document.servers!.push({ url, description, variables });
    return this;
  }

  setExternalDoc(description: string, url: string): this {
    this.document.externalDocs = { description, url };
    return this;
  }

  addTag(name: string, description?: string, externalDocs?: OpenAPIExternalDocs): this {
    this.document.tags!.push({ name, description, externalDocs });
    return this;
  }

  addBearerAuth(
    options: Partial<OpenAPISecurityScheme> = {},
    name: string = 'bearer'
  ): this {
    this.document.components!.securitySchemes![name] = {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      ...options,
    };
    return this;
  }

  addApiKey(
    options: { name: string; in: 'query' | 'header' | 'cookie'; description?: string },
    securityName: string = 'api_key'
  ): this {
    this.document.components!.securitySchemes![securityName] = {
      type: 'apiKey',
      name: options.name,
      in: options.in,
      description: options.description,
    };
    return this;
  }

  addBasicAuth(options: Partial<OpenAPISecurityScheme> = {}, name: string = 'basic'): this {
    this.document.components!.securitySchemes![name] = {
      type: 'http',
      scheme: 'basic',
      ...options,
    };
    return this;
  }

  addOAuth2(
    flows: OpenAPISecurityScheme['flows'],
    name: string = 'oauth2',
    description?: string
  ): this {
    this.document.components!.securitySchemes![name] = {
      type: 'oauth2',
      flows,
      description,
    };
    return this;
  }

  addSecurityRequirements(name: string, scopes: string[] = []): this {
    if (!this.document.security) {
      this.document.security = [];
    }
    this.document.security.push({ [name]: scopes });
    return this;
  }

  build(): OpenAPIDocument {
    return this.document as OpenAPIDocument;
  }
}
