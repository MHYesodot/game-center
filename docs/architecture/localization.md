# Localization Architecture

Status: Accepted source of truth for localization and internationalization

## Mandatory Rules

- All user-facing text comes from translation files.
- translation files are split by domain, not collapsed into one giant file.
- locale determines text direction.
- formatting uses `Intl` or localization helpers.
- backend APIs return stable error codes, not translated UI messages.

## Package Structure

```text
packages/i18n/
├── src/
│   ├── locales/
│   │   ├── en/
│   │   │   ├── common.json
│   │   │   ├── navigation.json
│   │   │   ├── catalog.json
│   │   │   ├── lobby.json
│   │   │   ├── matchmaking.json
│   │   │   └── errors.json
│   │   └── he/
│   ├── index.ts
│   └── validate-locales.mjs
```

## Locale Model

- required locales now: `en`, `he`
- `en` is LTR
- `he` is RTL

## Validation Requirements

Validation must fail build or CI on:

- missing locale directories
- missing translation files
- missing translation keys
- duplicate keys
- empty translations
- invalid placeholder syntax

Current validation is implemented via `npm run validate:i18n`.

## Client Integration Pattern

Required pattern:

```tsx
<Button>{t('game.actions.playNow')}</Button>
```

Forbidden pattern:

```tsx
<Button>Play Now</Button>
```

## API Error Contract Rule

Platform API should return codes such as:

```json
{ "code": "CATALOG_UNAVAILABLE" }
```

Clients then map the code to translation keys such as:

`errors.catalog.loadFailed`

## Web Audit Classification

### USER-FACING literals migrated

- buttons
- navigation
- empty-state messages
- section headings
- descriptive labels
- metrics labels

### TECHNICAL literals allowed

- route paths
- CSS class names
- package names
- command identifiers

### IDENTIFIER literals allowed

- game ids
- slugs
- integration keys

### TEST FIXTURE literals

- allowed only in test seed or test-specific files