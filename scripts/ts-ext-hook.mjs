/**
 * Node's type stripper does not add .ts the way Metro does.
 * App modules keep extensionless imports. Tests import those modules.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      // Fall through to the default resolver.
    }
  }
  return nextResolve(specifier, context);
}
