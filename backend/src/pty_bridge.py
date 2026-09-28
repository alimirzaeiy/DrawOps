#!/usr/bin/env python3
import sys
import os
import pty
import select
import termios
import struct
import fcntl
import json

def set_window_size(fd, rows, cols):
    try:
        winsize = struct.pack('HHHH', int(rows), int(cols), 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except Exception as e:
        pass

def main():
    if len(sys.argv) < 2:
        print("Usage: pty_bridge.py <command> [args...]", file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1:]
    cols = int(os.environ.get('COLUMNS', 80))
    rows = int(os.environ.get('LINES', 24))

    master, slave = pty.openpty()
    set_window_size(master, rows, cols)

    pid = os.fork()
    if pid == 0:
        # Child process
        os.close(master)
        os.setsid()
        # Set up slave as controlling terminal
        fcntl.ioctl(slave, termios.TIOCSCTTY, 0)
        os.dup2(slave, 0)
        os.dup2(slave, 1)
        os.dup2(slave, 2)
        if slave > 2:
            os.close(slave)

        os.environ['TERM'] = 'xterm-256color'
        try:
            os.execvp(cmd[0], cmd)
        except Exception as e:
            sys.stderr.write(f"Failed to exec {cmd[0]}: {e}\n")
            sys.exit(127)

    # Parent process
    os.close(slave)

    stdin_fileno = sys.stdin.fileno()
    stdout_fileno = sys.stdout.fileno()

    # Set non-blocking on stdin
    orig_fl = fcntl.fcntl(stdin_fileno, fcntl.F_GETFL)
    fcntl.fcntl(stdin_fileno, fcntl.F_SETFL, orig_fl | os.O_NONBLOCK)

    buffer = b""

    try:
        while True:
            rlist, _, _ = select.select([master, stdin_fileno], [], [])

            if master in rlist:
                try:
                    data = os.read(master, 4096)
                    if not data:
                        break
                    os.write(stdout_fileno, data)
                except OSError:
                    break

            if stdin_fileno in rlist:
                try:
                    chunk = os.read(stdin_fileno, 4096)
                    if not chunk:
                        break
                    
                    # Check for resize control packet: "__RESIZE__:rows:cols\n"
                    if b"__RESIZE__:" in chunk:
                        parts = chunk.split(b"__RESIZE__:")
                        if parts[0]:
                            os.write(master, parts[0])
                        for p in parts[1:]:
                            lines = p.split(b"\n", 1)
                            try:
                                r, c = lines[0].decode('utf-8').strip().split(':')
                                set_window_size(master, int(r), int(c))
                            except Exception:
                                pass
                            if len(lines) > 1 and lines[1]:
                                os.write(master, lines[1])
                    else:
                        os.write(master, chunk)
                except OSError:
                    pass

    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        os.close(master)
        try:
            os.kill(pid, 9)
        except Exception:
            pass

if __name__ == '__main__':
    main()
