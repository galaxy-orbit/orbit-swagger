import 'reflect-metadata';
import type { 
  OpenAPIDocument, 
  OpenAPIPathItem, 
  OpenAPIOperation, 
  OpenAPISchema,
  OpenAPIParameter,
  SwaggerDocumentOptions 
} from '../interfaces/swagger.interface';
import {
  API_OPERATION_METADATA,
  API_RESPONSE_METADATA,
  API_PARAM_METADATA,
  API_BODY_METADATA,
  API_TAGS_METADATA,
  API_SECURITY_METADATA,
  API_BEARER_AUTH_METADATA,
  API_EXCLUDE_METADATA,
  API_PROPERTY_METADATA,
  type ApiResponseOptions,
  type ApiParamOptions,
  type ApiBodyOptions,
  type ApiPropertyOptions,
} from '../decorators/api.decorators';

// Orbit core metadata keys (see @galaxy-stack/orbit-core metadata/constants)
const CONTROLLER_METADATA = 'orbit:controller';
const ROUTE_PATH_METADATA = 'orbit:route:path';
const ROUTE_METHOD_METADATA = 'orbit:route:method';

export class SwaggerExplorer {
  private schemas: Map<string, OpenAPISchema> = new Map();

  exploreControllers(
    controllers: any[],
    baseDocument: Omit<OpenAPIDocument, 'paths'>,
    options?: SwaggerDocumentOptions
  ): OpenAPIDocument {
    const paths: Record<string, OpenAPIPathItem> = {};

    for (const controller of controllers) {
      if (Reflect.getMetadata(API_EXCLUDE_METADATA, controller)) {
        continue;
      }

      const controllerPath = Reflect.getMetadata(CONTROLLER_METADATA, controller) || '';
      const controllerTags = Reflect.getMetadata(API_TAGS_METADATA, controller) || [controller.name.replace('Controller', '')];
      const controllerSecurity = Reflect.getMetadata(API_BEARER_AUTH_METADATA, controller) ||
                                  Reflect.getMetadata(API_SECURITY_METADATA, controller);

      const prototype = controller.prototype;
      const methodNames = Object.getOwnPropertyNames(prototype)
        .filter(name => name !== 'constructor' && typeof prototype[name] === 'function');

      for (const methodName of methodNames) {
        const method = prototype[methodName];
        
        if (Reflect.getMetadata(API_EXCLUDE_METADATA, controller, methodName)) {
          continue;
        }

        // Orbit stores route metadata on (prototype, propertyKey) pairs
        const routePath = Reflect.getMetadata(ROUTE_PATH_METADATA, prototype, methodName);
        const httpMethod = Reflect.getMetadata(ROUTE_METHOD_METADATA, prototype, methodName);

        if (!httpMethod) continue;

        const fullPath = this.normalizePath(`/${controllerPath}/${routePath || ''}`);
        
        if (!paths[fullPath]) {
          paths[fullPath] = {};
        }

        const operation = this.buildOperation(
          controller,
          methodName,
          controllerTags,
          controllerSecurity,
          options
        );

        (paths[fullPath] as any)[httpMethod.toLowerCase()] = operation;
      }
    }

    return {
      ...baseDocument,
      paths,
      components: {
        ...baseDocument.components,
        schemas: Object.fromEntries(this.schemas),
      },
    };
  }

  private buildOperation(
    controller: any,
    methodName: string,
    defaultTags: string[],
    defaultSecurity: any,
    options?: SwaggerDocumentOptions
  ): OpenAPIOperation {
    const operationMeta = Reflect.getMetadata(API_OPERATION_METADATA, controller, methodName) || {};
    const responses = Reflect.getMetadata(API_RESPONSE_METADATA, controller, methodName) || [];
    const params = Reflect.getMetadata(API_PARAM_METADATA, controller, methodName) || [];
    const body = Reflect.getMetadata(API_BODY_METADATA, controller, methodName);
    const methodTags = Reflect.getMetadata(API_TAGS_METADATA, controller, methodName);
    const methodSecurity = Reflect.getMetadata(API_BEARER_AUTH_METADATA, controller, methodName) ||
                           Reflect.getMetadata(API_SECURITY_METADATA, controller, methodName);

    const tags = methodTags || defaultTags;
    const security = methodSecurity || defaultSecurity;

    const operation: OpenAPIOperation = {
      operationId: operationMeta.operationId || 
        (options?.operationIdFactory?.(controller.name, methodName) || 
         `${controller.name}_${methodName}`),
      summary: operationMeta.summary,
      description: operationMeta.description,
      deprecated: operationMeta.deprecated,
      tags,
      parameters: this.buildParameters(params),
      responses: this.buildResponses(responses),
    };

    if (body) {
      operation.requestBody = this.buildRequestBody(body);
    }

    if (security) {
      operation.security = [security];
    }

    return operation;
  }

  private buildParameters(params: ApiParamOptions[]): OpenAPIParameter[] {
    return params.map(param => ({
      name: param.name,
      in: param.in || 'path',
      description: param.description,
      required: param.required ?? (param.in === 'path'),
      schema: this.typeToSchema(param.type, param.enum),
      example: param.example,
    }));
  }

  private buildResponses(responses: ApiResponseOptions[]): Record<string, any> {
    const result: Record<string, any> = {};

    if (responses.length === 0) {
      result['200'] = { description: 'Successful operation' };
      return result;
    }

    for (const response of responses) {
      const responseObj: any = {
        description: response.description || 'Response',
      };

      if (response.type || response.schema) {
        responseObj.content = {
          'application/json': {
            schema: response.schema || this.buildSchemaFromType(response.type, response.isArray),
          },
        };
      }

      result[String(response.status)] = responseObj;
    }

    return result;
  }

  private buildRequestBody(body: ApiBodyOptions): any {
    return {
      description: body.description,
      required: body.required ?? true,
      content: {
        'application/json': {
          schema: body.schema || this.buildSchemaFromType(body.type, body.isArray),
        },
      },
    };
  }

  private buildSchemaFromType(type: any, isArray?: boolean): OpenAPISchema {
    if (!type) {
      return { type: 'object' };
    }

    const schema = this.typeToSchema(type);

    if (isArray) {
      return { type: 'array', items: schema };
    }

    return schema;
  }

  private typeToSchema(type: any, enumValues?: any[]): OpenAPISchema {
    // Enum mapping must win even when no explicit type is given —
    // `@ApiParam({ enum: [...] })` without `type` previously lost the enum.
    if (enumValues) {
      return { type: 'string', enum: enumValues };
    }

    if (!type) {
      return { type: 'string' };
    }

    if (type === String || type.name === 'String') {
      return { type: 'string' };
    }
    if (type === Number || type.name === 'Number') {
      return { type: 'number' };
    }
    if (type === Boolean || type.name === 'Boolean') {
      return { type: 'boolean' };
    }
    if (type === Date || type.name === 'Date') {
      return { type: 'string', format: 'date-time' };
    }
    if (Array.isArray(type)) {
      return { type: 'array', items: this.typeToSchema(type[0]) };
    }

    if (typeof type === 'function' && type.name) {
      return this.buildSchemaFromClass(type);
    }

    return { type: 'object' };
  }

  private buildSchemaFromClass(classType: any): OpenAPISchema {
    const className = classType.name;

    if (this.schemas.has(className)) {
      return { $ref: `#/components/schemas/${className}` };
    }

    const properties: Record<string, OpenAPISchema> = {};
    const required: string[] = [];

    const propertyMeta: Map<string, ApiPropertyOptions> = 
      Reflect.getMetadata(API_PROPERTY_METADATA, classType) || new Map();

    for (const [propName, options] of propertyMeta) {
      const propSchema: OpenAPISchema = {
        ...this.typeToSchema(options.type, options.enum),
        description: options.description,
        default: options.default,
        example: options.example,
        nullable: options.nullable,
        minimum: options.minimum,
        maximum: options.maximum,
        minLength: options.minLength,
        maxLength: options.maxLength,
        pattern: options.pattern,
      };

      if (options.isArray) {
        properties[propName] = { type: 'array', items: propSchema };
      } else {
        properties[propName] = propSchema;
      }

      if (options.required !== false) {
        required.push(propName);
      }
    }

    const schema: OpenAPISchema = {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };

    this.schemas.set(className, schema);

    return { $ref: `#/components/schemas/${className}` };
  }

  private normalizePath(path: string): string {
    return path
      .replace(/\/+/g, '/')
      .replace(/\/$/, '') || '/';
  }
}
