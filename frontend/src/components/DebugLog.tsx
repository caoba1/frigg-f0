// frigg
// Copyright (C) 2026 Carlos de Obaldia Pastor
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useEffect, useState } from 'react';
import { subscribeLogs, getLogs } from '../utils/debug';
import { colors } from '../config/uiConfig';
import { strings } from '../config/strings';

const DebugLog: React.FC = () => {
  const [lines, setLines] = useState<string[]>(() => getLogs().slice(-20));
  useEffect(() => {
    const unsub = subscribeLogs((msg) => {
      setLines(l => [...l.slice(-18), msg]);
    });
    return unsub;
  }, []);
  return (
    <div style={{ border: '1px solid ' + colors.border, borderRadius: 8, padding: 8, background: colors.white, marginTop: 12 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 6 }}>{strings.debugLog.heading}</div>
      <div style={{ maxHeight: 200, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
        {lines.slice().reverse().map((l, i) => <div key={i} style={{ opacity: 0.95 }}>{l}</div>)}
      </div>
    </div>
  );
};

export default DebugLog;
