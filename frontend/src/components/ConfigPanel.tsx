// frigg
// Copyright (C) 2026 Carlos de Obaldia Pastor
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState, useEffect } from 'react';
import { colors } from '../config/uiConfig';
import { strings } from '../config/strings';

const ConfigPanel: React.FC = () => {

  const [open, setOpen] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem('configPanelOpen') ?? 'true');
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('configPanelOpen', JSON.stringify(open));
    } catch (e) {
      // TODO: debugLog for e
    }
  }, [open]);

  return (
    <div style={{ border: '2px solid ' + colors.configBorder, borderRadius: 10, margin: '16px 0', background: colors.configBackground }}>
      <div
        style={{ fontWeight: 'bold', fontSize: 18, padding: 12, cursor: 'pointer', borderBottom: open ? ('1px solid ' + colors.configBorder) : 'none', background: colors.configBackground, borderRadius: open ? '10px 10px 0 0' : 10 }}
        onClick={() => setOpen(o => !o)}>
        {strings.configPanel.collapseToggle} {strings.configPanel.heading}
      </div>
      {open && (
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{strings.configPanel.heading}</div>
          <div style={{ color: colors.configText, marginBottom: 16 }}>{strings.configPanel.emptyNotice}</div>
        </div>
      )}
    </div>
  );
};

export default ConfigPanel;
