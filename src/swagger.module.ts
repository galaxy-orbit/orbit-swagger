import type { OpenAPIDocument, SwaggerModuleOptions, SwaggerDocumentOptions } from './interfaces/swagger.interface';
import { DocumentBuilder } from './builder/document-builder';
import { SwaggerExplorer } from './explorer/swagger-explorer';

export class SwaggerModule {
  private static document: OpenAPIDocument | null = null;

  static createDocument(
    app: any,
    config: Omit<OpenAPIDocument, 'paths'>,
    options?: SwaggerDocumentOptions
  ): OpenAPIDocument {
    const explorer = new SwaggerExplorer();
    const controllers = this.getControllersFromApp(app, options);
    
    this.document = explorer.exploreControllers(controllers, config, options);
    return this.document;
  }

  static setup(path: string, app: any, document: OpenAPIDocument, options?: SwaggerModuleOptions): void {
    const swaggerPath = path.startsWith('/') ? path : `/${path}`;
    const jsonPath = options?.jsonDocumentUrl || `${swaggerPath}/json`;
    
    app.get(jsonPath, () => {
      return new Response(JSON.stringify(document, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    if (options?.swaggerUiEnabled !== false) {
      app.get(swaggerPath, () => {
        return new Response(this.generateSwaggerUI(document, swaggerPath), {
          headers: { 'Content-Type': 'text/html' },
        });
      });
    }
  }

  private static getControllersFromApp(app: any, options?: SwaggerDocumentOptions): any[] {
    if (options?.include) {
      return options.include;
    }

    if (app.controllers) {
      return app.controllers;
    }

    if (app.getControllers) {
      return app.getControllers();
    }

    if (app.container) {
      const controllers: any[] = [];
      for (const [token, provider] of app.container.providers) {
        if (typeof token === 'function' && token.name?.endsWith('Controller')) {
          controllers.push(token);
        }
      }
      return controllers;
    }

    return [];
  }

  private static generateSwaggerUI(document: OpenAPIDocument, basePath: string): string {
    const jsonUrl = `${basePath}/json`;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${document.info.title} - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "${jsonUrl}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        persistAuthorization: true,
      });
      window.ui = ui;
    };
  </script>
</body>
</html>`;
  }

  static getDocument(): OpenAPIDocument | null {
    return this.document;
  }
}

export { DocumentBuilder };
