import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XtermTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Server } from '../types';
import { X, Maximize2, Minimize2, KeyRound, RefreshCw, ShieldAlert, Check } from 'lucide-react';

interface TerminalDrawerProps {
  server: Server;
  onClose: () => void;
  onConnected?: () => void;
  onMasterReady?: () => void;
  autoSyncOnReady?: boolean;
  promptCloseOnSync?: boolean;
}

export const TerminalDrawer: React.FC<TerminalDrawerProps> = ({
  server,
  onClose,
  onConnected,
  onMasterReady,
  autoSyncOnReady = false,
  promptCloseOnSync = false,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XtermTerminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [isMaximized, setIsMaximized] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [syncedSuccessfully, setSyncedSuccessfully] = useState(false);
  const [showClosePrompt, setShowClosePrompt] = useState(false);

  const startTerminal = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnecting(true);

    const term = xtermInstance.current;
    if (term) {
      term.reset();
      term.writeln(`\x1b[32m[OpenSSH Terminal]\x1b[0m Spawning native session for \x1b[36m${server.username}@${server.host}\x1b[0m...`);
      term.writeln(`\x1b[90mTip: When prompted, enter key passphrase and touch your physical security key (FIDO2 / ECDSA-SK).\x1b[0m\r\n`);
    }

    const wsUrl = `ws://localhost:3001/ws/terminal?serverId=${server.id}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnecting(false);
      if (onConnected) onConnected();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output' && term) {
          term.write(msg.data);
        } else if (msg.type === 'error' && term) {
          term.writeln(`\r\n\x1b[31m[Error] ${msg.data}\x1b[0m`);
        } else if (msg.type === 'connected' && term) {
          term.writeln(`\x1b[32m[Ready]\x1b[0m ${msg.message}\r\n`);
        } else if (msg.type === 'master_ready') {
          setSyncedSuccessfully(true);
          if (promptCloseOnSync) {
            setShowClosePrompt(true);
          }
          if (term) {
            term.writeln(`\r\n\x1b[32;1m✔ Hardware Key / OpenSSH ControlMaster verified! Automatic server sync initiated...\x1b[0m\r\n`);
          }
          if (onMasterReady) {
            onMasterReady();
          }
        }
      } catch {
        if (term) term.write(event.data);
      }
    };

    ws.onclose = () => {
      setConnecting(false);
      if (term) {
        term.writeln('\r\n\x1b[33m[Session closed]\x1b[0m');
      }
    };

    ws.onerror = () => {
      setConnecting(false);
      if (term) {
        term.writeln('\r\n\x1b[31m[Connection error]\x1b[0m');
      }
    };
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XtermTerminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: '#121214',
        foreground: '#e6e6e6',
        cursor: '#27c93f',
        selectionBackground: '#27c93f44',
        green: '#27c93f',
        cyan: '#00e5ff',
        yellow: '#ffcc00',
        red: '#ff5f56',
        magenta: '#ff3b94',
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalRef.current);
    fit.fit();

    xtermInstance.current = term;
    fitAddon.current = fit;

    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onResize((size) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }));
      }
    });

    startTerminal();

    const handleWindowResize = () => fit.fit();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (wsRef.current) wsRef.current.close();
      term.dispose();
    };
  }, [server.id]);

  useEffect(() => {
    setTimeout(() => {
      fitAddon.current?.fit();
    }, 100);
  }, [isMaximized]);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-200 border-t-2 border-term-green shadow-term-glow bg-term-card flex flex-col ${
        isMaximized ? 'h-[90vh]' : 'h-80'
      }`}
    >
      {/* macOS Terminal Title Bar */}
      <div className="bg-[#212126] px-4 py-2 border-b border-term-borderMuted flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          <button onClick={onClose} className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block hover:opacity-80" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block opacity-80" />
          <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block opacity-80" />

          <div className="flex items-center space-x-2 ml-3 font-mono text-xs text-gray-300">
            <span className="text-term-apple font-bold text-sm"></span>
            <span className="text-purple-400 font-bold">{server.username}@{server.host}:</span>
            <span className="text-term-green font-mono">terminal session</span>
            <span className="text-[10px] text-gray-500 font-mono">({server.name})</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {syncedSuccessfully ? (
            <div className="flex items-center space-x-1.5 text-[11px] text-term-green bg-green-950/40 px-2.5 py-0.5 rounded border border-term-green/50 animate-pulse">
              <Check className="w-3.5 h-3.5 text-term-green" />
              <span>Touch Confirmed & Server Synced!</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-[11px] text-term-cyan bg-[#121214] px-2.5 py-0.5 rounded border border-gray-800">
              <KeyRound className="w-3.5 h-3.5 text-term-apple animate-bounce" />
              <span>Hardware Key / Touch Confirmation Active</span>
            </div>
          )}

          <button
            onClick={startTerminal}
            className="text-gray-400 hover:text-white p-1"
            title="Reconnect"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="text-gray-400 hover:text-white p-1"
            title={isMaximized ? 'Restore height' : 'Maximize terminal'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Optional Post-Sync Terminal Close Prompt Banner */}
      {showClosePrompt && (
        <div className="bg-[#181820] border-b border-term-green/40 px-4 py-2 flex items-center justify-between animate-in slide-in-from-top duration-200 select-none">
          <div className="flex items-center space-x-2 text-xs font-mono text-gray-200">
            <span className="w-2 h-2 rounded-full bg-term-green animate-ping"></span>
            <span className="text-term-green font-bold">SSH Sync Complete!</span>
            <span className="text-gray-400">Do you want to close this terminal session now?</span>
          </div>
          <div className="flex items-center space-x-2 font-mono">
            <button
              onClick={onClose}
              className="px-3 py-1 bg-term-green hover:bg-green-400 text-black font-bold text-xs rounded-lg transition shadow-sm cursor-pointer flex items-center space-x-1"
            >
              <span>Yes, Close Terminal</span>
            </button>
            <button
              onClick={() => setShowClosePrompt(false)}
              className="px-3 py-1 bg-[#212126] hover:bg-gray-800 text-gray-300 text-xs rounded-lg border border-gray-700 transition cursor-pointer"
            >
              <span>Keep Open</span>
            </button>
          </div>
        </div>
      )}

      {/* Terminal Canvas */}
      <div className="flex-1 w-full bg-[#121214] p-2 overflow-hidden" ref={terminalRef} />
    </div>
  );
};
