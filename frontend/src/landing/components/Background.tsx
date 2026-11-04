import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  life: number;
}

// Creative-coding backdrop: a flow field of drifting particles that bend around the cursor.
export default function Background() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: -9999, y: -9999 };
    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let raf = 0;
    let t = 0;

    const spawn = (): Particle => ({
      x: Math.random() * w,
      y: Math.random() * h,
      life: 120 + Math.random() * 220,
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(320, Math.floor((w * h) / 9000));
      particles = Array.from({ length: count }, spawn);
    };

    // Smooth angle field built from sines: cheap, continuous, and easy to tweak.
    const angleAt = (x: number, y: number, time: number) =>
      (Math.sin(x * 0.0042 + time * 0.0005) +
        Math.cos(y * 0.005 - time * 0.0004) +
        Math.sin((x + y) * 0.0025 + time * 0.0003)) *
      Math.PI;

    const frame = () => {
      t += 1;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.09)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1;

      for (const p of particles) {
        const a = angleAt(p.x, p.y, t);
        let vx = Math.cos(a) * 0.9;
        let vy = Math.sin(a) * 0.9;

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d = Math.hypot(dx, dy) + 0.001;
        if (d < 170) {
          const f = (170 - d) / 170;
          vx += (dx / d) * f * 2.4;
          vy += (dy / d) * f * 2.4;
        }

        const alpha = Math.min(1, p.life / 120) * 0.28;
        ctx.strokeStyle = `rgba(207, 213, 221, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + vx * 3, p.y + vy * 3);
        ctx.stroke();

        p.x += vx;
        p.y += vy;
        p.life -= 1;
        if (p.life <= 0 || p.x < 0 || p.y < 0 || p.x > w || p.y > h) Object.assign(p, spawn());
      }
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    // Reduced motion: draw a single frame and stop, instead of animating.
    frame();
    if (reduce) cancelAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} className="bg-canvas" aria-hidden="true" />;
}
