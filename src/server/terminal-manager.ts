import { existsSync } from 'fs';
import type { WebSocket } from 'ws';
import type { IPty } from 'node-pty';
import nodePty from 'node-pty';

// Handle CJS/ESM interop: when externalized, default import may be nested
const pty: { spawn: typeof nodePty.spawn } =
  (nodePty as any).default ?? nodePty;

interface TerminalSession {
  id: string;
  worktreeId: string;
  pty: IPty;
  ws: WebSocket | null;
  outputBuffer: string[];
  bufferHandler: { dispose(): void } | null;
}

export class TerminalManager {
  private sessions = new Map<string, TerminalSession>();
  private idCounter = 0;

  createSession(
    worktreeId: string,
    worktreePath: string,
    cols = 80,
    rows = 24,
  ): string {
    if (!existsSync(worktreePath)) {
      throw new Error(`Worktree path does not exist: ${worktreePath}`);
    }

    const sessionId = `term-${++this.idCounter}`;
    const shell = process.env.SHELL || '/bin/zsh';
    if (!existsSync(shell)) {
      throw new Error(`Shell not found: ${shell}`);
    }

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: worktreePath,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      } as Record<string, string>,
    });

    const outputBuffer: string[] = [];
    const bufferHandler = ptyProcess.onData((data: string) => {
      outputBuffer.push(data);
    });

    this.sessions.set(sessionId, {
      id: sessionId,
      worktreeId,
      pty: ptyProcess,
      ws: null,
      outputBuffer,
      bufferHandler,
    });

    ptyProcess.onExit(({ exitCode }) => {
      const session = this.sessions.get(sessionId);
      if (session?.ws) {
        try {
          session.ws.send(JSON.stringify({ type: 'exit', exitCode }));
          session.ws.close();
        } catch {
          // ws already closed
        }
      }
      this.sessions.delete(sessionId);
    });

    return sessionId;
  }

  attachWebSocket(sessionId: string, ws: WebSocket): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.ws = ws;

    // Stop buffering and replay any output captured before WS connected
    if (session.bufferHandler) {
      session.bufferHandler.dispose();
      session.bufferHandler = null;
    }
    for (const chunk of session.outputBuffer) {
      try {
        if (ws.readyState === ws.OPEN) {
          ws.send(chunk);
        }
      } catch { /* ws closed */ }
    }
    session.outputBuffer.length = 0;

    const dataHandler = session.pty.onData((data: string) => {
      try {
        if (ws.readyState === ws.OPEN) {
          ws.send(data);
        }
      } catch {
        // ws closed
      }
    });

    ws.on('message', (rawData: Buffer | string) => {
      const data =
        typeof rawData === 'string' ? rawData : rawData.toString('utf-8');
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'resize' && msg.cols && msg.rows) {
          session.pty.resize(msg.cols, msg.rows);
          return;
        }
      } catch {
        // Not JSON control message — raw input
      }
      session.pty.write(data);
    });

    ws.on('close', () => {
      dataHandler.dispose();
      session.ws = null;
    });

    return true;
  }

  resizeSession(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.resize(cols, rows);
    return true;
  }

  destroySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      session.ws?.close();
    } catch { /* ignore */ }
    try {
      session.pty.kill();
    } catch { /* ignore */ }

    this.sessions.delete(sessionId);
    return true;
  }

  destroyAllForWorktree(worktreeId: string): void {
    for (const [id, session] of this.sessions) {
      if (session.worktreeId === worktreeId) {
        this.destroySession(id);
      }
    }
  }

  destroyAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.destroySession(id);
    }
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}
