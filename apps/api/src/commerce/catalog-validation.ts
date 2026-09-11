export type AttributeDefinition = {
  key: string;
  type: string;
  required: boolean;
  options: unknown;
};

export function cleanVariantOptions(
  options: Record<string, string>,
): Record<string, string> {
  const entries = Object.entries(options);
  if (entries.length > 10)
    throw new Error('A variant can contain at most 10 options');
  const clean: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (
      !/^[a-z0-9_]{1,40}$/.test(key) ||
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > 80
    )
      throw new Error('Variant options are invalid');
    clean[key] = value.trim();
  }
  return clean;
}

export function validateCategoryAttributes(
  definitions: AttributeDefinition[],
  values: Record<string, unknown>,
): Record<string, string | number | boolean | string[]> {
  const allowed = new Map(
    definitions.map((definition) => [definition.key, definition]),
  );
  if (Object.keys(values).some((key) => !allowed.has(key)))
    throw new Error('Unknown category attribute');
  const clean: Record<string, string | number | boolean | string[]> = {};
  for (const definition of definitions) {
    const value = values[definition.key];
    if (value === undefined || value === null || value === '') {
      if (definition.required)
        throw new Error(
          `Required category attribute is missing: ${definition.key}`,
        );
      continue;
    }
    const choices = Array.isArray(definition.options)
      ? definition.options.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    const valid =
      definition.type === 'TEXT'
        ? typeof value === 'string' && value.length <= 300
        : definition.type === 'NUMBER'
          ? typeof value === 'number' && Number.isFinite(value)
          : definition.type === 'BOOLEAN'
            ? typeof value === 'boolean'
            : definition.type === 'SELECT'
              ? typeof value === 'string' && choices.includes(value)
              : definition.type === 'MULTISELECT'
                ? Array.isArray(value) &&
                  value.length <= 20 &&
                  value.every(
                    (item) =>
                      typeof item === 'string' && choices.includes(item),
                  )
                : false;
    if (!valid)
      throw new Error(`Invalid category attribute: ${definition.key}`);
    clean[definition.key] = value as string | number | boolean | string[];
  }
  return clean;
}
