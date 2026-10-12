---
navTitle: API Reference
order: 1
---
# Projects API

This page demonstrates documenting HTTP endpoints with ordinary Markdown. Use headings for routes, tables for parameters, and fenced code blocks for requests and responses.

Base URL: `https://api.example.com`

## `GET /v1/projects`

Returns projects available to the authenticated account.

Authentication is omitted from these example commands. Supply a bearer token from your application's secret store when calling a protected endpoint.

### Query parameters

| Name | Type | Description |
| --- | --- | --- |
| `limit` | integer | Maximum number of projects to return. Defaults to `20`. |
| `cursor` | string | Continue from a previous page of results. |

### Request

```bash
curl "https://api.example.com/v1/projects?limit=20" \
  -H "Accept: application/json"
```

### Response: `200 OK`

```json
{
  "data": [
    { "id": "prj_123", "name": "Website" },
    { "id": "prj_456", "name": "Mobile app" }
  ],
  "nextCursor": null
}
```

### Error: `401 Unauthorized`

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Provide a valid bearer token."
  }
}
```

## `POST /v1/projects`

Creates a project in the authenticated account.

### Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | Project name. |

### Request

```bash
curl "https://api.example.com/v1/projects" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"Documentation site"}'
```

### Response: `201 Created`

```json
{
  "id": "prj_789",
  "name": "Documentation site"
}
```

MDD renders this reference from Markdown. It does not import OpenAPI documents or send requests from the documentation page.
