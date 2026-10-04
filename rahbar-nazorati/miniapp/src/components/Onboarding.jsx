import React, { useRef, useState } from 'react';
import { ListChecks, BellRing, Award } from 'lucide-react';
import { haptic } from '../telegram.js';

const SLIDES = [
  { Icon: ListChecks, title: 'Barcha vazifalaringiz bir joyda.', text: "Kim, qachongacha, nima qilishi kerak — hammasi aniq va ko'z oldingizda." },
  { Icon: BellRing, title: "Deadline'larni o'tkazib yubormaysiz — tizim eslatib turadi.", text: "Muddatdan 24 soat va 2 soat oldin eslatma keladi." },
  { Icon: Award, title: 'Natijalaringiz adolatli baholanadi.', text: "Tezlik, muddatga rioya va sifat avtomatik o'lchanadi." },
];

export default function Onboarding({ onDone }) {
  const [index, setIndex] = useState(0);
  const ref = useRef(null);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const next = () => {
    haptic('light');
    if (index < SLIDES.length - 1) {
      ref.current.scrollTo({ left: (index + 1) * ref.current.clientWidth, behavior: 'smooth' });
    } else {
      haptic('success');
      onDone();
    }
  };

  return (
    <div className="onboarding">
      <div className="row" style={{ justifyContent: 'flex-end', minHeight: 24 }}>
        {index < SLIDES.length - 1 && (
          <button className="muted" onClick={onDone}>
            O'tkazib yuborish
          </button>
        )}
      </div>
      <div className="onb-slides" ref={ref} onScroll={onScroll}>
        {SLIDES.map((s) => (
          <div className="onb-slide" key={s.title}>
            <div className="onb-icon">
              <s.Icon size={56} strokeWidth={1.5} color="var(--accent)" />
            </div>
            <h1 className="onb-title">{s.title}</h1>
            <p className="onb-text">{s.text}</p>
          </div>
        ))}
      </div>
      <div className="onb-dots">
        {SLIDES.map((s, i) => (
          <span key={s.title} className={i === index ? 'active' : ''} />
        ))}
      </div>
      <button className="btn" style={{ padding: 17, fontSize: 17 }} onClick={next}>
        {index < SLIDES.length - 1 ? 'Davom etish' : 'Boshlash'}
      </button>
    </div>
  );
}
