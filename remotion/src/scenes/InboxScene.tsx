import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, RADIUS} from '../theme';
import {SANS} from '../fonts';
import {AppWindow} from '../components/AppWindow';
import {Caption, MimiraBadge, AttentionBadge} from '../components/Caption';
import {cameraKeyframes, pulse, riseIn, sceneFade} from '../anim';

const ESCALATIONS = [
  {name: 'คุณนุช · Noot J.', age: 'now', preview: 'สนใจฟิลเลอร์ใต้ตาค่ะ บวมกี่วัน เหมาะกับใครบ้างคะ', tag: 'filler-info', current: true},
  {name: 'Khun Mali · มะลิ', age: '2 min', preview: 'มีโปรฟิลเลอร์เดือนนี้มั้ยคะ อยากจองปรึกษา', tag: null, current: false},
  {name: 'คุณแก้ว · Kaew P.', age: '5 min', preview: 'อยากทราบว่าฟิลเลอร์คางอยู่ได้นานแค่ไหนค่ะ', tag: null, current: false},
  {name: 'Thida W. · ธิดา', age: '8 min', preview: 'เลื่อนนัดพรุ่งนี้ได้มั้ย ติดงานด่วน', tag: 'booking', current: false},
];

const Dots: React.FC<{frame: number}> = ({frame}) => (
  <div style={{display: 'flex', gap: 5, padding: '4px 2px'}}>
    {[0, 1, 2].map((i) => {
      const o = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((frame - i * 4) / 4));
      return <div key={i} style={{width: 8, height: 8, borderRadius: 9999, background: C.fgSubtle, opacity: o}} />;
    })}
  </div>
);

export const InboxScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const fade = sceneFade(frame, durationInFrames);

  const win = riseIn(frame, 0, 18, 18);
  // typing indicator appears, then reply replaces it
  const typingStart = 34;
  const replyStart = 70;
  const showReply = frame >= replyStart;
  const reply = riseIn(frame, replyStart, 14, 18);
  const camera = cameraKeyframes(frame, [
    [0, 1],
    [42, 1.025],
    [92, 1.135],
    [158, 1.135],
    [236, 1.035],
    [durationInFrames, 1],
  ]);
  const replyPulse = pulse(frame, replyStart + 2, 24);

  return (
    <AbsoluteFill style={{background: C.bg, justifyContent: 'center', alignItems: 'center', opacity: fade}}>
      <Caption kicker="Always-on, on-brand" title="Warm answers for treatment questions" frame={frame} total={durationInFrames} />

      <div style={{opacity: win.opacity, transform: `translateY(${win.y + 122}px) scale(${camera})`, transformOrigin: '74% 63%', fontFamily: SANS}}>
        <AppWindow active="Inbox">
          <div style={{display: 'grid', gridTemplateColumns: '360px 1fr', height: '100%'}}>
            {/* Left rail */}
            <aside style={{borderRight: `1px solid ${C.border}`, background: C.surface, overflow: 'hidden'}}>
              <div style={{padding: '16px 20px 8px', fontSize: 13, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', color: C.fgMuted}}>
                Escalations · 7
              </div>
              {ESCALATIONS.map((e) => (
                <div
                  key={e.name}
                  style={{
                    position: 'relative',
                    padding: '14px 20px',
                    borderBottom: `1px solid ${C.borderSubtle}`,
                    background: e.current ? C.surface2 : 'transparent',
                  }}
                >
                  {e.current && <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: C.fg}} />}
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
                    <span style={{fontSize: 15, fontWeight: 500, color: C.fg}}>{e.name}</span>
                    <span style={{fontSize: 12, color: C.fgSubtle, fontVariantNumeric: 'tabular-nums'}}>{e.age}</span>
                  </div>
                  <div style={{fontSize: 14, color: C.fgMuted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {e.preview}
                  </div>
                  <div style={{display: 'flex', gap: 6, marginTop: 8}}>
                    <AttentionBadge>Needs attention</AttentionBadge>
                    {e.tag && (
                      <span style={{fontSize: 12, color: C.fgMuted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 7px'}}>{e.tag}</span>
                    )}
                  </div>
                </div>
              ))}
            </aside>

            {/* Thread */}
            <section style={{display: 'flex', flexDirection: 'column', minHeight: 0}}>
              <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 28px', borderBottom: `1px solid ${C.border}`, background: C.surface}}>
                <div>
                  <div style={{fontSize: 16, fontWeight: 600, color: C.fg, display: 'flex', alignItems: 'center', gap: 10}}>
                    คุณนุช · Noot J.
                  </div>
                  <div style={{fontSize: 13, color: C.fgMuted, marginTop: 3}}>LINE @sukhumvit-skin · Thai · TH</div>
                </div>
                <div style={{display: 'flex', gap: 10}}>
                  <div style={{fontSize: 14, fontWeight: 500, color: C.fgMuted, padding: '9px 14px'}}>Flag</div>
                  <div style={{fontSize: 14, fontWeight: 500, color: C.ctaFg, background: C.ctaFill, borderRadius: RADIUS.sm, padding: '9px 16px'}}>Take over chat</div>
                </div>
              </header>

              <div style={{flex: 1, padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 14, background: C.bg, position: 'relative'}}>
                <div
                  style={{
                    position: 'absolute',
                    left: 20,
                    top: 164,
                    width: 792,
                    height: 210,
                    border: `2px solid ${C.ai}`,
                    borderRadius: 18,
                    opacity: replyPulse.opacity * 0.58,
                    transform: `scale(${replyPulse.scale})`,
                    transformOrigin: 'left center',
                    boxShadow: `0 0 0 8px ${C.ai}14, 0 18px 48px rgba(10,124,124,0.12)`,
                    pointerEvents: 'none',
                  }}
                />
                <div style={{fontSize: 12, color: C.fgSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center'}}>
                  Today · 14:08 ICT
                </div>

                {/* Customer bubble */}
                <div style={{maxWidth: '74%', alignSelf: 'flex-start'}}>
                  <div style={{fontSize: 13, color: C.fgMuted, fontWeight: 500, padding: '0 4px 4px'}}>คุณนุช</div>
                  <div style={{background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, borderBottomLeftRadius: 6, padding: '12px 16px', fontSize: 17, lineHeight: 1.5, color: C.fg}}>
                    สวัสดีค่ะ สนใจฟิลเลอร์ใต้ตาค่ะ อยากทราบว่าช่วยเรื่องอะไรได้บ้าง แล้วหลังทำจะบวมกี่วันคะ
                  </div>
                  <div style={{fontSize: 12, color: C.fgSubtle, padding: '4px 4px 0'}}>14:08</div>
                </div>

                {/* Mimira: typing → reply */}
                {!showReply && frame >= typingStart && (
                  <div style={{maxWidth: '74%', alignSelf: 'flex-start'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 4px'}}>
                      <span style={{fontSize: 13, color: C.fgMuted, fontWeight: 500}}>Mimira</span>
                      <MimiraBadge />
                    </div>
                    <div style={{background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, borderBottomLeftRadius: 6, padding: '10px 16px', width: 'fit-content'}}>
                      <Dots frame={frame} />
                    </div>
                  </div>
                )}

                {showReply && (
                  <div style={{maxWidth: '78%', alignSelf: 'flex-start', opacity: reply.opacity, transform: `translateY(${reply.y}px)`}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 4px'}}>
                      <span style={{fontSize: 13, color: C.fgMuted, fontWeight: 500}}>Mimira</span>
                      <MimiraBadge />
                    </div>
                    <div style={{background: C.surface, border: `1px solid ${replyPulse.opacity > 0 ? `${C.ai}66` : C.border}`, borderRadius: 14, borderBottomLeftRadius: 6, padding: '12px 16px', fontSize: 17, lineHeight: 1.55, color: C.fg, boxShadow: replyPulse.opacity > 0 ? `0 10px 30px rgba(10,124,124,${0.08 * replyPulse.opacity})` : 'none'}}>
                      ได้เลยค่ะคุณนุช 💛 ฟิลเลอร์ใต้ตาเหมาะกับเคสที่มีร่องลึกหรือดูโทรมจากวอลลุ่มที่ลดลงค่ะ หลังทำอาจบวมเล็กน้อยประมาณ 2-3 วัน และควรให้คุณหมอประเมินก่อนเพื่อเลือกปริมาณที่พอดีนะคะ ถ้าสะดวก Mimira ช่วยจองเวลาปรึกษากับคุณหมอให้ได้ค่ะ
                    </div>
                    <div style={{display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: C.fgSubtle, padding: '5px 4px 0'}}>
                      <span style={{fontVariantNumeric: 'tabular-nums'}}>14:08</span>
                      <span style={{color: C.ai, display: 'inline-flex', alignItems: 'center', gap: 4}}>▾ 3 sources · filler-under-eye.md</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </AppWindow>
      </div>
    </AbsoluteFill>
  );
};
