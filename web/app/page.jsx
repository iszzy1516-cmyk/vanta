"use client";

import { useEffect, useRef, useState } from "react";
import Scene from "../components/Scene";

const FINISHES = [
  { id: "void", label: "Void Black", chip: "#14130f", ring: "#3a382f" },
  { id: "amber", label: "Signal Amber", chip: "#e8a33d", ring: "#e8a33d" },
  { id: "silver", label: "Lab Silver", chip: "#c9ccd4", ring: "#8f939e" },
];

export default function Page() {
  const [ready, setReady] = useState(false);
  const [activeFinish, setActiveFinish] = useState("void");
  const loaderRef = useRef(null);

  // scene signals GLB readiness
  useEffect(() => {
    const onReady = () => {
      setReady(true);
      const t = setTimeout(() => loaderRef.current?.remove(), 1000);
      return () => clearTimeout(t);
    };
    window.addEventListener("vanta:ready", onReady);
    return () => window.removeEventListener("vanta:ready", onReady);
  }, []);

  // spec counters
  useEffect(() => {
    const els = document.querySelectorAll("[data-count]");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        io.unobserve(el);
        const target = parseFloat(el.dataset.count);
        const suffix = el.dataset.suffix || "";
        const decimals = (el.dataset.count.split(".")[1] || "").length;
        const start = performance.now();
        const dur = reduced ? 0 : 1200;
        const tick = (now) => {
          const t = dur === 0 ? 1 : Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = (target * eased).toFixed(decimals) + suffix;
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    els.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  // reserve form
  useEffect(() => {
    const form = document.getElementById("reserveForm");
    const note = document.getElementById("formNote");
    const email = document.getElementById("email");
    const onSubmit = (e) => {
      e.preventDefault();
      const value = email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        email.classList.add("border-red-400");
        note.textContent = "That email doesn't parse — check it and try again.";
        email.focus();
        return;
      }
      email.classList.remove("border-red-400");
      note.textContent = "Reservation logged. We'll wake you when the dark ships.";
      form.reset();
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  const pickFinish = (id) => {
    setActiveFinish(id);
    window.dispatchEvent(new CustomEvent("vanta:finish", { detail: id }));
  };

  return (
    <>
      {/* loader: calibration sweep */}
      <div
        ref={loaderRef}
        aria-hidden="true"
        className={`fixed inset-0 z-[100] bg-graphite flex flex-col items-center justify-center gap-7 transition-opacity duration-700 ${
          ready ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="font-mono text-xs tracking-[0.3em] text-mist">
          CALIBRATING
        </div>
        <div className="w-56 h-px bg-hairline overflow-hidden">
          <div className="calibrate-sweep h-full w-1/3 bg-amber" />
        </div>
        <div className="font-grotesk font-bold text-xl tracking-[0.12em]">
          VANTA
        </div>
      </div>

      {/* engineering grid backdrop */}
      <div className="grid-bg fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />

      <Scene />

      <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-16 py-6 bg-gradient-to-b from-graphite/90 to-transparent pointer-events-none">
        <a href="#one" className="pointer-events-auto font-grotesk font-bold text-lg tracking-[0.12em] text-bone">
          VANTA
        </a>
        <nav aria-label="Primary" className="pointer-events-auto flex items-center gap-6 md:gap-10">
          {["One", "Colorways", "Specs", "Camera"].map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase()}`}
              className="hidden md:inline text-mist hover:text-bone focus-visible:text-bone transition-colors text-base"
            >
              {l}
            </a>
          ))}
          <a
            href="#reserve"
            className="px-5 py-2 rounded-full border border-hairline text-bone hover:border-amber focus-visible:border-amber transition-colors text-base"
          >
            Reserve
          </a>
        </nav>
      </header>

      <main className="relative z-10 pointer-events-none">
        {/* HERO */}
        <section id="one" className="min-h-screen flex flex-col justify-center gap-10 px-6 md:px-16 pt-28 pb-16">
          <div className="max-w-3xl grid gap-7 pointer-events-auto">
            <p className="font-mono text-xs tracking-[0.25em] text-amber">INSTRUMENT 01 — NIGHT VISION PHONE</p>
            <h1 className="font-grotesk font-bold leading-[1.04] text-[clamp(42px,6.6vw,88px)]">
              Calibrated
              <br />
              for the dark.
            </h1>
            <p className="text-mist text-lg md:text-xl max-w-xl">
              Vanta One is machined from a single block of titanium-ceramic and
              tuned like lab equipment. The only light it gives back is 6.9
              inches of spectral display.
            </p>
            <div className="flex items-center gap-7 flex-wrap">
              <a
                href="#reserve"
                className="btn-primary inline-block px-9 py-4 rounded-full bg-amber text-graphite font-semibold text-base"
              >
                Reserve Vanta One
              </a>
            </div>
            <p className="text-mist text-sm">From $999 — ships March 2027</p>
          </div>

          <ul aria-label="Key specifications" className="pointer-events-auto grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6 border-t border-hairline pt-7 max-w-5xl">
            {[
              { v: "6.9", s: "″", label: "LTPO spectral display" },
              { v: "200", s: "MP", label: "Night camera, f/1.4" },
              { v: "72", s: " hr", label: "Mixed-use battery" },
              { v: "8.9", s: " mm", label: "Titanium-ceramic body" },
            ].map((spec) => (
              <li key={spec.label}>
                <strong data-count={spec.v} data-suffix={spec.s} className="block font-grotesk font-medium text-2xl md:text-3xl">
                  0{spec.s}
                </strong>
                <span className="text-mist text-sm">{spec.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* COLORWAYS */}
        <section id="colorways" className="min-h-[92vh] flex flex-col justify-center gap-7 px-6 md:px-16 py-24">
          <h2 className="font-grotesk font-bold text-[clamp(30px,4vw,54px)] max-w-xl">
            Three finishes. One instrument.
          </h2>
          <p className="text-mist text-lg max-w-2xl">
            Every Vanta One is sealed in low-reflectance ceramic. Pick a finish
            — the instrument dissolves and reforms in the new material.
          </p>
          <div className="flex gap-4 flex-wrap pointer-events-auto" role="group" aria-label="Choose a finish">
            {FINISHES.map((f) => (
              <button
                key={f.id}
                type="button"
                data-finish={f.id}
                onClick={() => pickFinish(f.id)}
                aria-pressed={activeFinish === f.id}
                className={`swatch flex items-center gap-3 px-6 py-3.5 rounded-full border bg-surface/70 backdrop-blur text-base font-medium ${
                  activeFinish === f.id ? "is-active border-amber" : "border-hairline"
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full border border-white/20"
                  style={{ background: f.chip, boxShadow: `0 0 0 1px ${f.ring}` }}
                />
                {f.label}
              </button>
            ))}
          </div>
        </section>

        {/* SPECS + exploded view */}
        <section id="specs" className="min-h-[110vh] flex flex-col justify-center gap-7 px-6 md:px-16 py-24">
          <h2 className="font-grotesk font-bold text-[clamp(30px,4vw,54px)] max-w-xl">
            Engineered absence.
          </h2>
          <p className="text-mist text-lg max-w-2xl">
            Scroll to open the instrument. Every part separates along its real
            assembly axis — nothing here is decorative.
          </p>
          <dl className="pointer-events-auto grid md:grid-cols-2 gap-px bg-hairline border border-hairline rounded-2xl overflow-hidden max-w-3xl">
            {[
              ["DISPLAY", "6.9″ LTPO spectral OLED, 1–120Hz, 3200 nits peak"],
              ["CAMERA", "200MP spectral night sensor, f/1.4, sensor-shift OIS"],
              ["BATTERY", "5,400 mAh silicon-anode, 72 hours mixed use"],
              ["BODY", "Titanium-ceramic unibody, 8.9 mm, 199 g"],
              ["VIDEO", "4K 120fps true-dark capture from 1 lux"],
              ["CHIP", "Vanta V1, 3nm — tuned for silence, not benchmarks"],
            ].map(([dt, dd]) => (
              <div key={dt} className="bg-graphite/85 backdrop-blur px-7 py-6">
                <dt className="font-mono text-xs tracking-[0.18em] text-amber mb-2">{dt}</dt>
                <dd className="text-mist text-base">{dd}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* CAMERA */}
        <section id="camera" className="min-h-[92vh] flex flex-col justify-center gap-7 px-6 md:px-16 py-24 md:items-end md:text-right">
          <h2 className="font-grotesk font-bold text-[clamp(30px,4vw,54px)] max-w-xl">
            Sees more in the dark.
          </h2>
          <p className="text-mist text-lg max-w-xl">
            A 200-megapixel spectral sensor stacks the photons your eyes miss.
            Night shots come out in full color, flashless — the dark develops
            itself.
          </p>
          <ul className="grid gap-6 max-w-md md:ml-auto pointer-events-auto">
            {[
              ["Spectral stack", "Nine frames fused into one exposure. Handheld, zero blur."],
              ["Void optics", "f/1.4 aperture with sensor-shift stabilization."],
              ["True-dark video", "4K at 120fps in as little as 1 lux."],
            ].map(([name, desc]) => (
              <li key={name} className="grid gap-1 pl-6 relative text-left">
                <span className="absolute left-0 top-2 w-2 h-2 rounded-[2px] bg-amber" aria-hidden="true" />
                <strong className="font-semibold">{name}</strong>
                <span className="text-mist text-base">{desc}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* RESERVE */}
        <section id="reserve" className="min-h-[92vh] flex flex-col justify-center gap-7 px-6 md:px-16 py-24">
          <h2 className="font-grotesk font-bold text-[clamp(30px,4vw,54px)]">
            Own the night.
          </h2>
          <p className="text-mist text-lg max-w-xl">
            Reservations open March 2027. Leave your email and we will wake you
            when the dark ships.
          </p>
          <form id="reserveForm" noValidate className="flex flex-col sm:flex-row gap-4 pointer-events-auto w-full sm:w-auto">
            <label htmlFor="email" className="sr-only">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@night.owl"
              className="px-7 py-4 rounded-full border border-hairline bg-surface/80 text-bone text-base outline-none focus:border-amber w-full sm:w-[340px] transition-colors"
            />
            <button type="submit" className="btn-primary px-9 py-4 rounded-full bg-amber text-graphite font-semibold text-base w-full sm:w-auto">
              Reserve
            </button>
          </form>
          <p id="formNote" role="status" className="text-mist text-sm" />
        </section>

        <footer className="flex flex-col gap-3 px-6 md:px-16 pt-16 pb-12 border-t border-hairline">
          <span className="font-grotesk font-bold tracking-[0.12em]">VANTA</span>
          <span className="text-mist text-sm max-w-xl">
            A fictional instrument brand, designed and built end-to-end with AI
            tools — references, design system, calibrated 3D asset, and this
            site.
          </span>
        </footer>
      </main>
    </>
  );
}
