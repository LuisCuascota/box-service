# Skill: modify-domain

Guía para modificar funcionalidades en dominios existentes del servicio,
siguiendo exactamente las convenciones del proyecto.

## Uso

```
/modify-domain <descripción del cambio>
```

Ejemplos:

- `/modify-domain agregar filtro por fecha en searchEntry`
- `/modify-domain nuevo método getLoanSummary en LoanService`
- `/modify-domain agregar campo phone al response de getPersons`

---

## Antes de modificar: leer siempre primero

Antes de proponer cualquier cambio, leer los archivos afectados:

1. `src/repository/I<Name>.service.ts` — interfaz y tipos
2. `src/service/<Name>.service.ts` — implementación
3. `src/handler/<Name>Handler.ts` — handlers (solo si el cambio es visible en HTTP)

No proponer código sin haber leído el archivo completo. El contexto importa:
otros métodos del servicio pueden ser reutilizables.

---

## Tipo A: Agregar un nuevo método al servicio

### 1. Actualizar la interfaz (`src/repository/I<Name>.service.ts`)

Agregar la firma del método nuevo. Los tipos de retorno son siempre `Observable<T>`.

```typescript
// Agregar en INameService:
newMethod(param: ParamType): Observable<ReturnType>;

// Agregar el tipo si no existe:
export interface NuevoTipo {
  field: string;
  // ...
}
```

### 2. Implementar en el servicio (`src/service/<Name>.service.ts`)

**Patrón obligatorio para métodos públicos:**

```typescript
public newMethod(param: ParamType): Observable<ReturnType> {
  return of(1).pipe(
    map(() =>
      this._knex
        .select(/* columnas */)
        .from({ alias: TablesEnum.TABLE })
        // ...joins, wheres
        .toQuery()
    ),
    mergeMap((query: string) => this._mysql.query<ReturnType>(query)),
    // transformaciones adicionales con map()
    tag("<Name>Service | newMethod")   // SIEMPRE al final
  );
}
```

**Patrón para métodos privados de apoyo:**

```typescript
private _helperMethod(param: ParamType): Observable<ReturnType> {
  return of(1).pipe(
    mergeMap(() => /* lógica */),
    tag("<Name>Service | _helperMethod")
  );
}
```

### 3. Exponer en el handler (`src/handler/<Name>Handler.ts`)

Solo si el método nuevo debe ser un endpoint HTTP:

```typescript
export const newEndpoint: Handler = (event) => {
  return processResponse<ReturnType>(
    nameService.newMethod(event.pathParameters.id),
    event
  );
};
```

Y mostrar el bloque YAML correspondiente (no escribir en `serverless.yml`):

```yaml
getNewEndpoint:
  handler: src/handler/<Name>Handler.newEndpoint
  events:
    - http:
        path: api/v1/<name>/<sub-path>
        method: GET
        cors:
          origin: "*"
          headers:
            - Authorization
```

---

## Tipo B: Modificar una query existente

### Agregar columnas al SELECT

```typescript
// Antes
this._knex.select("*").from({ e: TablesEnum.ENTRY });

// Después: usar buildCol con alias de tabla
this._knex
  .select(
    buildCol({ e: TColEntry.NUMBER }),
    buildCol({ e: TColEntry.DATE }),
    buildCol({ p: TColPerson.NAMES }) // columna nueva
  )
  .from({ e: TablesEnum.ENTRY });
```

### Agregar un JOIN

```typescript
.innerJoin(
  { p: TablesEnum.PERSON },
  buildCol({ p: TColPerson.DNI }),
  buildCol({ a: TColAccount.DNI })
)
// Para joins condicionales usar leftJoin
.leftJoin({ d: TablesEnum.ENTRY_DETAIL }, (builder) =>
  builder
    .on(buildCol({ d: TColDetail.ENTRY_NUMBER }), "=", buildCol({ e: TColEntry.NUMBER }))
    .andOn(buildCol({ d: TColDetail.TYPE_ID }), "=", this._knex.raw("?", [typeId]))
)
```

### Agregar filtros dinámicos

Extraer en un método privado `_buildFilters` si hay más de 2 condiciones:

```typescript
private _buildFilters(query: QueryBuilder, params?: FilterType) {
  if (params?.field)
    query.where(buildCol({ alias: TColEnum.FIELD }), params.field);

  if (params?.startDate)
    query.where(buildCol({ alias: TColEnum.DATE }), ">=", params.startDate);

  if (params?.endDate)
    query.where(buildCol({ alias: TColEnum.DATE }), "<=", params.endDate);
}
```

Llamarlo dentro del pipe con `map`:

```typescript
map((query: QueryBuilder) => {
  this._buildFilters(query, params);
  return query.toQuery();
}),
```

---

## Tipo C: Modificar un tipo/interfaz existente

### Agregar campo opcional

```typescript
// En src/repository/I<Name>.service.ts
export interface NombreInterface {
  existingField: string;
  newField?: string; // opcional si no siempre viene de DB
}
```

### Agregar parámetro de filtro

```typescript
export interface NameParams {
  existingParam?: number;
  newFilter?: string; // agregar aquí
}
```

Luego actualizar el método del servicio que recibe el parámetro para usar el nuevo filtro.

---

## Operadores RxJS: cuándo usar cada uno

| Situación                                  | Operador                           | Ejemplo                                   |
| ------------------------------------------ | ---------------------------------- | ----------------------------------------- |
| Operación async secuencial (una tras otra) | `mergeMap`                         | gateway query → transformación            |
| Iteración preservando orden                | `concatMap` + `toArray()`          | procesar lista de items                   |
| Operaciones en paralelo                    | `forkJoin([...])`                  | dos queries independientes                |
| Lógica condicional en el pipe              | `iif(() => condition, obs1, obs2)` | si existe loan, calcular; si no, `of([])` |
| Iterar un array dentro del pipe            | `switchMap(() => from(array))`     | dispersar items para procesarlos          |
| Transformación síncrona                    | `map`                              | extraer campo, formatear                  |
| Valor inicial del pipe                     | `of(1).pipe(...)`                  | arrancar cualquier método                 |

**Nunca usar `async/await` ni `Promise` — todo es Observable.**

---

## Reglas invariables (no negociables)

1. **`tag(...)` siempre al final** de cada método público y privado que retorne Observable

   ```typescript
   tag("ServiceName | methodName");
   ```

2. **Knex para todo SQL** — nunca strings crudos salvo `this._knex.raw("?", [value])` para valores

   ```typescript
   // ✓ correcto
   this._knex.select().from(TablesEnum.X).where("id", id).toQuery()
   // ✗ prohibido
   `SELECT * FROM X WHERE id = ${id}`;
   ```

3. **`buildCol` para referencias de columna con alias de tabla**

   ```typescript
   buildCol({ alias: TColEnum.FIELD }); // → "alias.field"
   buildCol({ alias: TColEnum.FIELD }, "name"); // → "alias.field as name"
   ```

4. **Handlers siempre delgados** — solo llaman `processResponse<T>(observable, event)`:

   ```typescript
   // ✓ correcto
   export const find: Handler = (event) =>
     processResponse<T[]>(service.method(event.queryStringParameters), event);

   // ✗ prohibido
   export const find: Handler = async (event) => {
     const result = await service.method();
     return { statusCode: 200, body: JSON.stringify(result) };
   };
   ```

5. **`reflect-metadata` como primera línea** en handlers

   ```typescript
   import "reflect-metadata";
   ```

6. **No modificar `serverless.yml`** — mostrar el bloque YAML para que el usuario lo copie

---

## Checklist antes de entregar el cambio

- [ ] Se leyeron todos los archivos afectados antes de proponer código
- [ ] Si hay reglas de negocio involucradas: validado con el agente `business-rules-validator`
- [ ] Si hay cálculos numéricos involucrados: validado con el agente `financial-calculator`
- [ ] La interfaz en `src/repository/` refleja el cambio
- [ ] Cada método nuevo/modificado termina con `tag(...)`
- [ ] No hay `async/await` ni `Promise` introducidos
- [ ] El SQL se construye con Knex
- [ ] Si se agregó endpoint: handler delgado + bloque YAML mostrado
- [ ] Si se agregó tipo: está en el archivo de repositorio correspondiente
