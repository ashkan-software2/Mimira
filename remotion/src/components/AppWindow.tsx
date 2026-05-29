import React from 'react';
import {C, RADIUS, SHADOW_MODAL} from '../theme';
import {SANS} from '../fonts';

type Tab = {label: string; count?: number};
const TABS: Tab[] = [
  {label: 'Inbox', count: 7},
  {label: 'Knowledge'},
  {label: 'Bookings', count: 3},
  {label: 'Broadcasts'},
  {label: 'Settings'},
];

export const AppWindow: React.FC<{
  active: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({active, children, style}) => {
  return (
    <div
      style={{
        width: 1560,
        height: 856,
        background: C.surface,
        borderRadius: RADIUS.lg,
        border: `1px solid ${C.border}`,
        boxShadow: SHADOW_MODAL,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: '40px 56px 1fr',
        fontFamily: SANS,
        ...style,
      }}
    >
      {/* macOS-style window bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 16px',
          background: C.surface2,
          borderBottom: `1px solid ${C.borderSubtle}`,
        }}
      >
        {['#ff5f57', '#febc2e', '#28c840'].map((dot) => (
          <div
            key={dot}
            style={{width: 12, height: 12, borderRadius: RADIUS.full, background: dot}}
          />
        ))}
        <div
          style={{
            margin: '0 auto',
            fontSize: 13,
            color: C.fgSubtle,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          platform.mimira.tech/{active.toLowerCase()}
        </div>
      </div>

      {/* Mimira topbar */}
      <header
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 24,
          padding: '0 24px',
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 16}}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: RADIUS.sm,
              background: C.fg,
              color: C.bg,
              display: 'grid',
              placeItems: 'center',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            M
          </div>
          <div>
            <span style={{color: C.fg}}>Mimira</span>
            <span style={{color: C.fgSubtle, margin: '0 8px'}}>·</span>
            <span style={{color: C.fgMuted, fontWeight: 400}}>Sukhumvit Skin &amp; Laser</span>
          </div>
        </div>

        <nav style={{display: 'flex', gap: 2, justifySelf: 'start'}}>
          {TABS.map((t) => {
            const isActive = t.label === active;
            return (
              <div
                key={t.label}
                style={{
                  padding: '8px 13px',
                  fontSize: 15,
                  fontWeight: 500,
                  borderRadius: RADIUS.sm,
                  color: isActive ? C.fg : C.fgMuted,
                  background: isActive ? C.surface2 : 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                {t.label}
                {t.count != null && (
                  <span
                    style={{
                      fontSize: 12,
                      fontVariantNumeric: 'tabular-nums',
                      color: isActive ? C.fg : C.fgMuted,
                      background: isActive ? C.surface : C.borderSubtle,
                      border: isActive ? `1px solid ${C.border}` : 'none',
                      padding: '1px 7px',
                      borderRadius: RADIUS.full,
                    }}
                  >
                    {t.count}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: RADIUS.full,
            background: C.surface2,
            border: `1px solid ${C.border}`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            color: C.fg,
          }}
        >
          ภ
        </div>
      </header>

      {/* Content */}
      <div style={{minHeight: 0, background: C.bg, position: 'relative'}}>{children}</div>
    </div>
  );
};
