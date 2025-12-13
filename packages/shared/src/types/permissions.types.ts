export class Permission {
  constructor(
    public readonly resource: string,
    public readonly action: string
  ) {}

  toString(): string {
    return `${this.resource}:${this.action}`;
  }
}

export function checkPermissions(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.every(perm => userPermissions.includes(perm));
}