import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, RADIUS} from '../theme';
import {SANS} from '../fonts';
import {AppWindow} from '../components/AppWindow';
import {Caption} from '../components/Caption';
import {cameraKeyframes, pulse, riseIn, sceneFade, enter} from '../anim';

const BookingCard: React.FC<{
  name: string;
  when: string;
  treatment: string;
  phone: string;
  quote: string;
  stamp: string;
  highlight?: boolean;
  confirmed?: boolean;
  actionPulse?: {opacity: number; scale: number};
}> = ({name, when, treatment, phone, quote, stamp, highlight, confirmed, actionPulse}) => (
  <div
    style={{
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 20,
      alignItems: 'center',
      background: C.surface,
      border: `1px solid ${highlight ? `${C.ai}66` : C.border}`,
      borderRadius: RADIUS.md,
      padding: '18px 22px',
      boxShadow: highlight ? `0 0 0 3px ${C.ai}1a` : 'none',
    }}
  >
    {highlight && <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: C.ai, borderRadius: '3px 0 0 3px'}} />}
    <div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
        <span style={{fontSize: 18, fontWeight: 600, color: C.fg}}>{name}</span>
        <span style={{fontSize: 15, color: C.fgMuted, fontVariantNumeric: 'tabular-nums'}}>{when}</span>
      </div>
      <div style={{fontSize: 15, color: C.fgMuted, marginTop: 5}}>
        {treatment} <span style={{color: C.fgSubtle, margin: '0 6px'}}>·</span> {phone}
      </div>
      <div style={{fontSize: 15, color: C.fg, background: C.surface2, border: `1px solid ${C.borderSubtle}`, borderRadius: RADIUS.sm, padding: '9px 13px', marginTop: 12, lineHeight: 1.5}}>
        {quote}
        <span style={{color: C.fgSubtle, fontSize: 12, marginLeft: 10}}>from chat · {stamp}</span>
      </div>
    </div>
    <div style={{display: 'flex', flexDirection: 'column', gap: 8, minWidth: 150}}>
      {confirmed ? (
        <div style={{fontSize: 15, fontWeight: 500, color: C.success, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '10px 16px', border: `1px solid ${C.success}55`, background: `${C.success}12`, borderRadius: RADIUS.sm}}>
          ✓ Confirmed
        </div>
      ) : (
        <>
          <div
            style={{
              position: 'relative',
              fontSize: 15,
              fontWeight: 500,
              color: C.ctaFg,
              background: C.ctaFill,
              borderRadius: RADIUS.sm,
              padding: '10px 16px',
              textAlign: 'center',
              transform: `scale(${actionPulse ? 1 - actionPulse.opacity * 0.035 : 1})`,
              boxShadow: actionPulse ? `0 0 0 ${Math.round(actionPulse.opacity * 9)}px ${C.ai}24` : 'none',
            }}
          >
            Confirm
          </div>
          <div style={{fontSize: 15, fontWeight: 500, color: C.fg, background: C.surface, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '10px 16px', textAlign: 'center'}}>Reschedule</div>
        </>
      )}
    </div>
  </div>
);

export const BookingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const fade = sceneFade(frame, durationInFrames);
  const win = riseIn(frame, 0, 18, 18);

  const newCard = riseIn(frame, 26, 22, 22);
  const confirmAt = 96;
  const confirmed = frame >= confirmAt;
  const toast = enter(frame, confirmAt, 12);
  const confirmPulse = pulse(frame, confirmAt - 2, 18);
  const camera = cameraKeyframes(frame, [
    [0, 1],
    [30, 1.03],
    [82, 1.1],
    [132, 1.1],
    [178, 1.035],
    [durationInFrames, 1],
  ]);

  return (
    <AbsoluteFill style={{background: C.bg, justifyContent: 'center', alignItems: 'center', opacity: fade}}>
      <Caption kicker="From chat to calendar" title="Every booking, captured automatically" frame={frame} total={durationInFrames} />

      <div style={{opacity: win.opacity, transform: `translateY(${win.y + 122}px) scale(${camera})`, transformOrigin: '58% 38%', fontFamily: SANS}}>
        <AppWindow active="Bookings">
          <div style={{padding: '28px 40px', height: '100%', overflow: 'hidden'}}>
            <div style={{fontSize: 28, fontWeight: 600, color: C.fg, letterSpacing: '-0.02em', marginBottom: 22}}>Bookings</div>

            <div style={{display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14}}>
              <span style={{fontSize: 18, fontWeight: 600, color: C.fg}}>Pending</span>
              <span style={{fontSize: 16, color: C.fgMuted}}>· 3</span>
              <span style={{fontSize: 14, color: C.fgSubtle, marginLeft: 'auto'}}>Confirm with the customer over LINE, then mark here</span>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
              {/* Newly captured card */}
              <div style={{opacity: newCard.opacity, transform: `translateY(${newCard.y}px)`}}>
                <BookingCard
                  name="คุณนุช · Noot J."
                  when="Sat 31 May · 14:00 ICT"
                  treatment="Filler consultation"
                  phone="081-234-xxxx"
                  quote="ขอจองปรึกษาฟิลเลอร์วันเสาร์บ่ายสองค่ะ อยากให้คุณหมอดูใต้ตาก่อนค่ะ"
                  stamp="14:13"
                  highlight={!confirmed}
                  confirmed={confirmed}
                  actionPulse={confirmPulse}
                />
              </div>

              <BookingCard
                name="Khun Mali · มะลิ"
                when='"next week, afternoon"'
                treatment="HIFU full face"
                phone="089-771-xxxx"
                quote="สนใจ HIFU ค่ะ พอจะว่างอาทิตย์หน้าบ่ายๆ ก็ได้นะคะ"
                stamp="12:02"
              />
              <BookingCard
                name="Aey · เอ๋"
                when="Sat 31 May · 15:00 ICT"
                treatment="Picosure (pigmentation)"
                phone="No phone on file"
                quote="ที่จองไว้เสาร์ ขอเปลี่ยนเป็นบ่ายสามได้มั้ยคะ"
                stamp="11:47"
              />
            </div>
          </div>
        </AppWindow>
      </div>

      {/* Success toast */}
      <div
        style={{
          position: 'absolute',
          bottom: 110,
          right: 240,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: C.surface,
          border: `1px solid ${C.success}55`,
          borderLeft: `3px solid ${C.success}`,
          borderRadius: RADIUS.md,
          padding: '14px 20px',
          fontFamily: SANS,
          fontSize: 16,
          color: C.fg,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          opacity: toast,
          transform: `translateY(${(1 - toast) * 16}px)`,
        }}
      >
        <span style={{width: 9, height: 9, borderRadius: 9999, background: C.success}} />
        Booking confirmed · LINE message sent to คุณนุช
      </div>
    </AbsoluteFill>
  );
};
