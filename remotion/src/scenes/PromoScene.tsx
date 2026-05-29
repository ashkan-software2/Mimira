import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, RADIUS} from '../theme';
import {SANS} from '../fonts';
import {AppWindow} from '../components/AppWindow';
import {Caption} from '../components/Caption';
import {cameraKeyframes, pulse, riseIn, sceneFade, enter} from '../anim';

const PROMO = 'โปรฟิลเลอร์เดือนนี้ค่ะ ✨ รับส่วนลดพิเศษสำหรับฟิลเลอร์ใต้ตาและคาง พร้อมปรึกษาคุณหมอก่อนทำทุกเคส สนใจให้ทีมงานช่วยดูคิวว่าง ทักกลับมาได้เลยนะคะ 💛';
const TOTAL = 1213;

export const PromoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const fade = sceneFade(frame, durationInFrames);
  const win = riseIn(frame, 0, 18, 18);

  const sendAt = 56;
  const sending = frame >= sendAt;
  const progress = enter(frame, sendAt, 44); // 0→1 over send
  const sent = Math.round(progress * TOTAL);
  const done = progress >= 0.999;
  const sendPulse = pulse(frame, sendAt - 1, 18);
  const phonePulse = pulse(frame, sendAt + 42, 26);
  const camera = cameraKeyframes(frame, [
    [0, 1],
    [34, 1.025],
    [78, 1.095],
    [132, 1.095],
    [180, 1.04],
    [durationInFrames, 1],
  ]);

  return (
    <AbsoluteFill style={{background: C.bg, justifyContent: 'center', alignItems: 'center', opacity: fade}}>
      <Caption kicker="Promotions" title="Launch a filler campaign with the right offer" frame={frame} total={durationInFrames} />

      <div style={{opacity: win.opacity, transform: `translateY(${win.y + 122}px) scale(${camera})`, transformOrigin: '56% 58%', fontFamily: SANS}}>
        <AppWindow active="Broadcasts">
          <div style={{padding: '28px 40px', height: '100%', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32}}>
            {/* Composer */}
            <div style={{background: C.surface, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, padding: 24, display: 'flex', flexDirection: 'column'}}>
              <div style={{fontSize: 20, fontWeight: 600, color: C.fg, marginBottom: 18}}>Filler promotion</div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20}}>
                <div style={{border: `1px solid ${C.ai}66`, background: `${C.ai}12`, borderRadius: RADIUS.md, padding: '13px 15px'}}>
                  <div style={{fontSize: 13, fontWeight: 500, color: C.fgMuted, marginBottom: 4}}>Campaign</div>
                  <div style={{fontSize: 16, fontWeight: 600, color: C.fg}}>Under-eye &amp; chin filler</div>
                </div>
                <div style={{border: `1px solid ${C.border}`, background: C.surface2, borderRadius: RADIUS.md, padding: '13px 15px'}}>
                  <div style={{fontSize: 13, fontWeight: 500, color: C.fgMuted, marginBottom: 4}}>Goal</div>
                  <div style={{fontSize: 16, fontWeight: 600, color: C.fg}}>Book doctor consults</div>
                </div>
              </div>

              <div style={{fontSize: 13, fontWeight: 500, color: C.fgMuted, marginBottom: 8}}>Send to</div>
              <div style={{display: 'flex', gap: 10, marginBottom: 20}}>
                {[
                  {n: 'All customers', c: '4,247 recipients', sel: false},
                  {n: 'Asked about filler', c: '1,213 recipients', sel: true},
                ].map((s) => (
                  <div
                    key={s.n}
                    style={{
                      flex: 1,
                      border: `1px solid ${s.sel ? C.fg : C.border}`,
                      background: s.sel ? C.surface2 : C.surface,
                      borderRadius: RADIUS.md,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{fontSize: 15, fontWeight: 500, color: C.fg}}>{s.n}</div>
                    <div style={{fontSize: 13, color: C.fgMuted, marginTop: 3, fontVariantNumeric: 'tabular-nums'}}>{s.c}</div>
                  </div>
                ))}
              </div>

              <div style={{fontSize: 13, fontWeight: 500, color: C.fgMuted, marginBottom: 8}}>Message</div>
              <div style={{border: `1px solid ${C.border}`, borderRadius: RADIUS.md, padding: '14px 16px', fontSize: 16, lineHeight: 1.55, color: C.fg, background: C.surface, minHeight: 130, boxShadow: sendPulse.opacity > 0 ? `0 0 0 4px ${C.ai}14` : 'none'}}>
                {PROMO}
              </div>

              {/* Footer / send */}
              <div style={{marginTop: 'auto', paddingTop: 22}}>
                {sending && (
                  <div style={{marginBottom: 14}}>
                    <div style={{height: 8, background: C.surface2, borderRadius: RADIUS.full, overflow: 'hidden', border: `1px solid ${C.border}`}}>
                      <div style={{height: '100%', width: `${progress * 100}%`, background: C.success, borderRadius: RADIUS.full}} />
                    </div>
                    <div style={{fontSize: 14, color: done ? C.success : C.fgMuted, marginTop: 8, fontVariantNumeric: 'tabular-nums'}}>
                      {done ? `✓ Sent to ${TOTAL.toLocaleString()} customers` : `Sending… ${sent.toLocaleString()} / ${TOTAL.toLocaleString()}`}
                    </div>
                  </div>
                )}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{fontSize: 14, color: C.fgMuted}}>
                    Will send to <strong style={{color: C.fg, fontWeight: 600}}>1,213</strong> customers · est. <strong style={{color: C.fg, fontWeight: 600}}>~3 min</strong>
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: C.ctaFg,
                      background: sending ? C.fgMuted : C.ctaFill,
                      borderRadius: RADIUS.sm,
                      padding: '11px 20px',
                      transform: `scale(${sending && frame < sendAt + 6 ? 0.96 : 1 - sendPulse.opacity * 0.035})`,
                      boxShadow: sendPulse.opacity > 0 ? `0 0 0 ${Math.round(sendPulse.opacity * 9)}px ${C.ai}24` : 'none',
                    }}
                  >
                    {done ? 'Sent ✓' : sending ? 'Sending…' : 'Send to 1,213'}
                  </div>
                </div>
              </div>
            </div>

            {/* LINE phone preview */}
            <div style={{display: 'flex', flexDirection: 'column'}}>
              <div style={{fontSize: 13, fontWeight: 500, color: C.fgMuted, marginBottom: 12}}>LINE preview · updates live</div>
              <div style={{flex: 1, background: '#e9eef3', borderRadius: 28, padding: 16, display: 'flex', flexDirection: 'column', border: `1px solid ${C.border}`}}>
                {/* phone header */}
                <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px 14px', borderBottom: `1px solid #d7dee6`}}>
                  <span style={{fontSize: 22, color: C.fgMuted}}>‹</span>
                  <div style={{width: 34, height: 34, borderRadius: RADIUS.full, background: C.fg, color: C.bg, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600}}>SS</div>
                  <div style={{lineHeight: 1.2}}>
                    <div style={{fontSize: 15, fontWeight: 600, color: C.fg}}>Sukhumvit Skin &amp; Laser</div>
                    <div style={{fontSize: 12, color: C.fgMuted}}>Official account</div>
                  </div>
                </div>
                {/* phone body */}
                <div style={{flex: 1, padding: '18px 6px'}}>
                  <div style={{textAlign: 'center', fontSize: 12, color: C.fgMuted, marginBottom: 14}}>14:32</div>
                  <div style={{maxWidth: '86%'}}>
                    <div style={{background: C.surface, borderRadius: 16, borderTopLeftRadius: 6, padding: '13px 16px', fontSize: 16, lineHeight: 1.55, color: C.fg, boxShadow: phonePulse.opacity > 0 ? `0 10px 32px rgba(10,124,124,${0.12 * phonePulse.opacity})` : '0 1px 2px rgba(0,0,0,0.06)', border: phonePulse.opacity > 0 ? `1px solid ${C.ai}55` : '1px solid transparent'}}>
                      {PROMO}
                    </div>
                    <div style={{fontSize: 11, color: C.fgMuted, marginTop: 5, paddingLeft: 4}}>14:32 · {done ? 'read' : 'delivered'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AppWindow>
      </div>
    </AbsoluteFill>
  );
};
