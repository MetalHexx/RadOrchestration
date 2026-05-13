import os from 'node:os';
import path from 'node:path';

export interface UserDataPaths {
  readonly root: string;
  readonly installJson: string;
  readonly orchestrationYml: string;
  readonly ui: string;
  readonly templates: string;
  readonly projects: string;
  readonly logs: string;
  readonly runtime: string;
  readonly bootstrapLock: string;
}

export function userDataPaths(): UserDataPaths {
  const root = path.join(os.homedir(), '.radorch');
  return {
    root,
    installJson: path.join(root, 'install.json'),
    orchestrationYml: path.join(root, 'orchestration.yml'),
    ui: path.join(root, 'ui'),
    templates: path.join(root, 'templates'),
    projects: path.join(root, 'projects'),
    logs: path.join(root, 'logs'),
    runtime: path.join(root, 'runtime'),
    bootstrapLock: path.join(root, 'runtime', 'bootstrap.lock'),
  };
}
