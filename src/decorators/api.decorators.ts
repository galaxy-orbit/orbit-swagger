import 'reflect-metadata';
import type { OpenAPISchema, OpenAPISecurityRequirement } from '../interfaces/swagger.interface';

export const API_OPERATION_METADATA = 'swagger:operation';
export const API_RESPONSE_METADATA = 'swagger:response';
export const API_PARAM_METADATA = 'swagger:param';
export const API_BODY_METADATA = 'swagger:body';
export const API_TAGS_METADATA = 'swagger:tags';
export const API_SECURITY_METADATA = 'swagger:security';
export const API_BEARER_AUTH_METADATA = 'swagger:bearerAuth';
export const API_EXCLUDE_METADATA = 'swagger:exclude';
export const API_PROPERTY_METADATA = 'swagger:property';

export interface ApiOperationOptions {
  summary?: string;
  description?: string;
  operationId?: string;
  deprecated?: boolean;
}

export interface ApiResponseOptions {
  status: number;
  description?: string;
  type?: any;
  isArray?: boolean;
  schema?: OpenAPISchema;
}

export interface ApiParamOptions {
  name: string;
  description?: string;
  required?: boolean;
  type?: any;
  enum?: any[];
  example?: any;
  in?: 'path' | 'query' | 'header' | 'cookie';
}

export interface ApiQueryOptions extends Omit<ApiParamOptions, 'in'> {}

export interface ApiBodyOptions {
  description?: string;
  required?: boolean;
  type?: any;
  isArray?: boolean;
  schema?: OpenAPISchema;
}

export interface ApiPropertyOptions {
  description?: string;
  required?: boolean;
  type?: any;
  isArray?: boolean;
  enum?: any[];
  default?: any;
  example?: any;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  nullable?: boolean;
}

export function ApiOperation(options: ApiOperationOptions): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(API_OPERATION_METADATA, options, target.constructor, propertyKey);
    return descriptor;
  };
}

export function ApiResponse(options: ApiResponseOptions): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const responses: ApiResponseOptions[] = 
      Reflect.getMetadata(API_RESPONSE_METADATA, target.constructor, propertyKey) || [];
    responses.push(options);
    Reflect.defineMetadata(API_RESPONSE_METADATA, responses, target.constructor, propertyKey);
    return descriptor;
  };
}

export function ApiOkResponse(options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return ApiResponse({ status: 200, description: 'Successful operation', ...options });
}

export function ApiCreatedResponse(options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return ApiResponse({ status: 201, description: 'Created successfully', ...options });
}

export function ApiBadRequestResponse(options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return ApiResponse({ status: 400, description: 'Bad request', ...options });
}

export function ApiUnauthorizedResponse(options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return ApiResponse({ status: 401, description: 'Unauthorized', ...options });
}

export function ApiForbiddenResponse(options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return ApiResponse({ status: 403, description: 'Forbidden', ...options });
}

export function ApiNotFoundResponse(options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return ApiResponse({ status: 404, description: 'Not found', ...options });
}

export function ApiInternalServerErrorResponse(options?: Omit<ApiResponseOptions, 'status'>): MethodDecorator {
  return ApiResponse({ status: 500, description: 'Internal server error', ...options });
}

export function ApiParam(options: ApiParamOptions): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const params: ApiParamOptions[] = 
      Reflect.getMetadata(API_PARAM_METADATA, target.constructor, propertyKey) || [];
    params.push({ ...options, in: options.in || 'path', required: options.required ?? true });
    Reflect.defineMetadata(API_PARAM_METADATA, params, target.constructor, propertyKey);
    return descriptor;
  };
}

export function ApiQuery(options: ApiQueryOptions): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const params: ApiParamOptions[] = 
      Reflect.getMetadata(API_PARAM_METADATA, target.constructor, propertyKey) || [];
    params.push({ ...options, in: 'query', required: options.required ?? false });
    Reflect.defineMetadata(API_PARAM_METADATA, params, target.constructor, propertyKey);
    return descriptor;
  };
}

export function ApiBody(options: ApiBodyOptions): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(API_BODY_METADATA, options, target.constructor, propertyKey);
    return descriptor;
  };
}

export function ApiTags(...tags: string[]): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey !== undefined) {
      Reflect.defineMetadata(API_TAGS_METADATA, tags, target.constructor, propertyKey);
    } else {
      Reflect.defineMetadata(API_TAGS_METADATA, tags, target);
    }
    return descriptor as any;
  };
}

export function ApiBearerAuth(name: string = 'bearer'): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    const security: OpenAPISecurityRequirement = { [name]: [] };
    if (propertyKey !== undefined) {
      Reflect.defineMetadata(API_BEARER_AUTH_METADATA, security, target.constructor, propertyKey);
    } else {
      Reflect.defineMetadata(API_BEARER_AUTH_METADATA, security, target);
    }
    return descriptor as any;
  };
}

export function ApiSecurity(name: string, scopes: string[] = []): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    const security: OpenAPISecurityRequirement = { [name]: scopes };
    if (propertyKey !== undefined) {
      Reflect.defineMetadata(API_SECURITY_METADATA, security, target.constructor, propertyKey);
    } else {
      Reflect.defineMetadata(API_SECURITY_METADATA, security, target);
    }
    return descriptor as any;
  };
}

export function ApiExcludeEndpoint(): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(API_EXCLUDE_METADATA, true, target.constructor, propertyKey);
    return descriptor;
  };
}

export function ApiExcludeController(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(API_EXCLUDE_METADATA, true, target);
  };
}

export function ApiProperty(options: ApiPropertyOptions = {}): PropertyDecorator {
  return (target, propertyKey) => {
    const properties: Map<string, ApiPropertyOptions> = 
      Reflect.getMetadata(API_PROPERTY_METADATA, target.constructor) || new Map();
    
    const designType = Reflect.getMetadata('design:type', target, propertyKey);
    
    properties.set(String(propertyKey), {
      ...options,
      type: options.type || designType,
    });
    
    Reflect.defineMetadata(API_PROPERTY_METADATA, properties, target.constructor);
  };
}

export function ApiPropertyOptional(options: Omit<ApiPropertyOptions, 'required'> = {}): PropertyDecorator {
  return ApiProperty({ ...options, required: false });
}
