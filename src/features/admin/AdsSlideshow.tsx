import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { listActiveAds } from './ads.service';
import type { Ad } from './ads.types';
import '../../theme/admin-ads.css';

interface AdsSlideshowProps {
  autoPlayMs?: number;
}

export default function AdsSlideshow({ autoPlayMs = 5000 }: AdsSlideshowProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listActiveAds();
        setAds(rows);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto-play
  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % ads.length);
    }, autoPlayMs);
    return () => clearInterval(timer);
  }, [ads.length, autoPlayMs]);

  if (loading || ads.length === 0) {
    return null;
  }

  function next() {
    setIndex((i) => (i + 1) % ads.length);
  }

  function prev() {
    setIndex((i) => (i - 1 + ads.length) % ads.length);
  }

  const current = ads[index];

  function handleClick() {
    if (current.linkUrl) {
      window.open(current.linkUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <section className="ads-slideshow" dir="rtl">
      <div
        className="ads-slideshow-track"
        style={{ transform: `translateX(${index * 100}%)` }}
      >
        {ads.map((ad) => (
          <div
            key={ad.id}
            className="ads-slide"
            onClick={ad.linkUrl ? handleClick : undefined}
            style={{ cursor: ad.linkUrl ? 'pointer' : 'default' }}
          >
            <img src={ad.imageUrl} alt={ad.title} />
            <div className="ads-slide-overlay">
              <h3 className="ads-slide-title">{ad.title}</h3>
              {ad.description && (
                <p className="ads-slide-desc">{ad.description}</p>
              )}
              {ad.ctaText && ad.linkUrl && (
                <span className="ads-slide-cta">
                  {ad.ctaText}
                  <ArrowLeft size={12} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {ads.length > 1 && (
        <>
          <button
            type="button"
            className="ads-slideshow-nav prev"
            onClick={prev}
            aria-label="السابق"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            className="ads-slideshow-nav next"
            onClick={next}
            aria-label="التالي"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="ads-slideshow-dots">
            {ads.map((ad, i) => (
              <button
                key={ad.id}
                type="button"
                className={`ads-dot ${i === index ? 'is-active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={`الشريحة ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}