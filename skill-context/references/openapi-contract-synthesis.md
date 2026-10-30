# OpenAPI Contract Synthesis Specification

Derives OpenAPI 3.1 schema contracts from route definitions and handler signatures.

## Extraction Rules

1. **Path Mapping**: Correlate route decorators/methods (`app.get('/users/:id')` -> `/users/{id}`).
2. **Parameter Typing**: Map path parameters and query strings to typed OpenAPI schema components.
3. **Status Codes**: Register default success codes (`200 OK`, `201 Created`) and standard error envelopes (`400`, `401`, `500`).
4. **Validation Schemas**: Link Zod, Pydantic, or JSON schemas directly to requestBody components.
