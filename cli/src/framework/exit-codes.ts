export const ExitCode = {
  Success: 0,
  UserError: 1,
  SystemError: 2,
} as const;
export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
