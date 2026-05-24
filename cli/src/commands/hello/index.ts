export interface RunHelloOpts {
  stdout: NodeJS.WriteStream;
  stderr?: NodeJS.WriteStream;
}

export async function runHello(opts: RunHelloOpts): Promise<number> {
  opts.stdout.write('Hello, World!\n');
  return 0;
}
