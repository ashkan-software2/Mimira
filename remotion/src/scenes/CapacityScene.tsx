import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, RADIUS} from '../theme';
import {SANS} from '../fonts';
import {AppWindow} from '../components/AppWindow';
import {Caption, MimiraBadge} from '../components/Caption';
import {cameraKeyframes, pulse, riseIn, sceneFade} from '../anim';

const ROWS = [
  {t: 'Filler consultation', perDay: 6, slot: '30 min'},
  {t: 'Under-eye filler', perDay: 4, slot: '60 min'},
  {t: 'HIFU', perDay: 3, slot: '90 min'},
  {t: 'Consultation', perDay: 3, slot: '20 min'},
];

export const CapacityScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const fade = sceneFade(frame, durationInFrames);
  const win = riseIn(frame, 0, 18, 18);
  const chat = riseIn(frame, 60, 16, 22);
  const capacityPulse = pulse(frame, 58, 26);
  const camera = cameraKeyframes(frame, [
    [0, 1],
    [32, 1.025],
    [82, 1.09],
    [128, 1.09],
    [160, 1.035],
    [durationInFrames, 1],
  ]);

  return (
    <AbsoluteFill style={{background: C.bg, justifyContent: 'center', alignItems: 'center', opacity: fade}}>
      <Caption kicker="Capacity-aware" title="Knows your limits — never overbooks" frame={frame} total={durationInFrames} />

      <div style={{opacity: win.opacity, transform: `translateY(${win.y + 122}px) scale(${camera})`, transformOrigin: '42% 46%', fontFamily: SANS}}>
        <AppWindow active="Settings">
          <div style={{padding: '28px 40px', height: '100%', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 28}}>
            {/* Capacity card */}
            <div>
              <div style={{fontSize: 28, fontWeight: 600, color: C.fg, letterSpacing: '-0.02em', marginBottom: 22}}>Settings</div>
              <div style={{background: C.surface, border: `1px solid ${capacityPulse.opacity > 0 ? `${C.ai}66` : C.border}`, borderRadius: RADIUS.lg, overflow: 'hidden', boxShadow: capacityPulse.opacity > 0 ? `0 16px 42px rgba(10,124,124,${0.09 * capacityPulse.opacity})` : 'none'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: `1px solid ${C.borderSubtle}`}}>
                  <span style={{color: C.ai, fontSize: 16}}>›</span>
                  <span style={{fontSize: 19, fontWeight: 600, color: C.fg}}>Capacity rules</span>
                  <span style={{fontSize: 14, color: C.fgMuted, marginLeft: 'auto'}}>4 treatments · 18 bookings/day max</span>
                </div>
                <div style={{padding: '18px 22px'}}>
                  <div style={{fontSize: 14, color: C.fgMuted, marginBottom: 16, lineHeight: 1.5}}>
                    Mimira mentions these when customers ask about availability, so she never promises a slot you can’t take.
                  </div>
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 16}}>
                    <thead>
                      <tr style={{textAlign: 'left', color: C.fgMuted, fontSize: 13}}>
                        <th style={{padding: '0 0 10px', fontWeight: 500}}>Treatment</th>
                        <th style={{padding: '0 0 10px', fontWeight: 500, textAlign: 'right'}}>Bookings / day</th>
                        <th style={{padding: '0 0 10px', fontWeight: 500, textAlign: 'right'}}>Slot length</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ROWS.map((r, i) => {
                        const ri = riseIn(frame, 22 + i * 8, 12, 16);
                        return (
                          <tr key={r.t} style={{opacity: ri.opacity, transform: `translateY(${ri.y}px)`}}>
                            <td style={{padding: '12px 0', borderTop: `1px solid ${C.borderSubtle}`, color: C.fg}}>{r.t}</td>
                            <td style={{padding: '12px 0', borderTop: `1px solid ${C.borderSubtle}`, color: C.fg, textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>{r.perDay}</td>
                            <td style={{padding: '12px 0', borderTop: `1px solid ${C.borderSubtle}`, color: C.fg, textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>{r.slot}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* How Mimira uses it — chat preview */}
            <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: chat.opacity, transform: `translateY(${chat.y}px)`}}>
              <div style={{fontSize: 13, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.fgSubtle, marginBottom: 14}}>
                In a real conversation
              </div>
              <div style={{maxWidth: '92%', alignSelf: 'flex-end'}}>
                <div style={{background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14, borderBottomRightRadius: 6, padding: '12px 16px', fontSize: 16, lineHeight: 1.5, color: C.fg}}>
                  วันเสาร์นี้ทำ HIFU ได้มั้ยคะ
                </div>
              </div>
              <div style={{maxWidth: '92%', alignSelf: 'flex-start', marginTop: 14}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 5px'}}>
                  <span style={{fontSize: 13, color: C.fgMuted, fontWeight: 500}}>Mimira</span>
                  <MimiraBadge />
                </div>
                <div style={{background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, borderBottomLeftRadius: 6, padding: '12px 16px', fontSize: 16, lineHeight: 1.55, color: C.fg}}>
                  วันเสาร์คิว HIFU เต็มแล้วค่ะ 🙏 รบกวนเป็นวันอาทิตย์ 11:00 น. ได้ไหมคะ ยังมีคิวว่างอยู่ค่ะ
                </div>
              </div>
            </div>
          </div>
        </AppWindow>
      </div>
    </AbsoluteFill>
  );
};
