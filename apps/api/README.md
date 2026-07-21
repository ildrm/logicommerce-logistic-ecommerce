# API

NestJS 11 with Fastify. Controllers delegate to application services and all
tenant-owned repositories require resolved tenant context. Swagger is served at
`/api/docs`; health endpoints live outside the versioned business API.
