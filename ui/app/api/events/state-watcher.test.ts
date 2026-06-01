import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { wireProjectStateWatcher, type StateWatcherEvent } from './state-watcher';

const ROOT = path.join('/projects-root');

function fakeWatcherFactory() {
  const watchPaths: string[] = [];
  let closes = 0;
  const emitter = new EventEmitter() as EventEmitter & { close: () => Promise<void> };
  emitter.close = async () => {
    closes += 1;
  };
  return {
    make: (watchPath: string) => {
      watchPaths.push(watchPath);
      return emitter;
    },
    emitter,
    watchPaths: () => watchPaths,
    closes: () => closes,
  };
}

test('state watcher is created on a plain directory path — no glob characters (chokidar v4)', () => {
  const f = fakeWatcherFactory();
  wireProjectStateWatcher({ projectsDir: ROOT, makeWatcher: f.make, emit: () => {} });

  const paths = f.watchPaths();
  assert.equal(paths.length, 1, 'exactly one watcher created');
  const watched = paths[0];
  assert.equal(watched, ROOT, 'watches the projects directory directly');
  assert.ok(!watched.includes('*'), 'no glob star passed to the factory');
  assert.ok(!watched.includes('**'), 'no recursive glob passed to the factory');
});

test('change on a state.json emits state_change with the derived projectName', () => {
  const f = fakeWatcherFactory();
  const events: StateWatcherEvent[] = [];
  wireProjectStateWatcher({ projectsDir: ROOT, makeWatcher: f.make, emit: (e) => events.push(e) });

  f.emitter.emit('change', path.join(ROOT, 'MYPROJ', 'state.json'));

  assert.equal(events.length, 1, 'one event emitted');
  assert.equal(events[0].type, 'state_change');
  assert.equal(events[0].projectName, 'MYPROJ');
  assert.equal(events[0].filePath, path.join(ROOT, 'MYPROJ', 'state.json'));
});

test('change on a non-state.json path emits no state event (basename filter)', () => {
  const f = fakeWatcherFactory();
  const events: StateWatcherEvent[] = [];
  wireProjectStateWatcher({ projectsDir: ROOT, makeWatcher: f.make, emit: (e) => events.push(e) });

  f.emitter.emit('change', path.join(ROOT, 'MYPROJ', 'tasks', 'foo.md'));

  assert.equal(events.length, 0, 'non-state.json change is ignored');
});

test('add on a state.json emits project_added with the derived projectName', () => {
  const f = fakeWatcherFactory();
  const events: StateWatcherEvent[] = [];
  wireProjectStateWatcher({ projectsDir: ROOT, makeWatcher: f.make, emit: (e) => events.push(e) });

  f.emitter.emit('add', path.join(ROOT, 'ADDED', 'state.json'));

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'project_added');
  assert.equal(events[0].projectName, 'ADDED');
});

test('unlink on a state.json emits project_removed with the derived projectName', () => {
  const f = fakeWatcherFactory();
  const events: StateWatcherEvent[] = [];
  wireProjectStateWatcher({ projectsDir: ROOT, makeWatcher: f.make, emit: (e) => events.push(e) });

  f.emitter.emit('unlink', path.join(ROOT, 'GONE', 'state.json'));

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'project_removed');
  assert.equal(events[0].projectName, 'GONE');
});

test('add/unlink on a non-state.json path emit no state event', () => {
  const f = fakeWatcherFactory();
  const events: StateWatcherEvent[] = [];
  wireProjectStateWatcher({ projectsDir: ROOT, makeWatcher: f.make, emit: (e) => events.push(e) });

  f.emitter.emit('add', path.join(ROOT, 'MYPROJ', 'notes.txt'));
  f.emitter.emit('unlink', path.join(ROOT, 'MYPROJ', 'state.json.proposed'));

  assert.equal(events.length, 0);
});

test('returns a close() that closes the underlying watcher', async () => {
  const f = fakeWatcherFactory();
  const handle = wireProjectStateWatcher({ projectsDir: ROOT, makeWatcher: f.make, emit: () => {} });

  await handle.close();
  assert.equal(f.closes(), 1, 'underlying watcher closed once');
});
