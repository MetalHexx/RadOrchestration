export type ErrorType = 'user_error' | 'system_error';

export abstract class RadorchError extends Error {
  public abstract readonly type: ErrorType;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UserError extends RadorchError {
  public readonly type = 'user_error' as const;
}

export class SystemError extends RadorchError {
  public readonly type = 'system_error' as const;
}
