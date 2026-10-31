export const STRENGTH = "STRENGTH"

export const WEEKS = {
  1: { sets: 2, reps: 10, rpe: 7, rir: 3, label: "Easy week", w: "Learn the move" },
  2: { sets: 3, reps: 8, rpe: 8, rir: 2, label: "Build", w: "Small bump" },
  3: { sets: 3, reps: 6, rpe: 9, rir: 1, label: "Heavy", w: "Bigger bump" },
  4: { sets: 3, reps: 4, rpe: 10, rir: 0, label: "Send it", w: "Biggest bump" },
} as const

export type WeekNumber = keyof typeof WEEKS
export type DayNumber = 1 | 2

export type Exercise = {
  n: string
  rx: string
  q: string
  tag?: string
  ea?: boolean
}

export type Block = {
  id: string
  name: string
  time: string
  why: string
  tip?: string
  note?: string
  tag?: string
  optional?: boolean
  ss?: boolean
  both?: Exercise[]
  d1?: Exercise[]
  d2?: Exercise[]
}

export const BLOCKS: Block[] = [
  {
    id: "reset",
    name: "Breathe & roll",
    time: "~5 min",
    why: "<b>Calm down first.</b> Your body can only handle so much stress. Lowering it now leaves room for the good stress of lifting. Rolling also pushes fluid through tight, sore muscles, and doing it every time tells your body \"lifting starts now.\"",
    tip: "Lean into tender spots, but keep it at 7/10 pain or less. Breathe slowly and let yourself melt over the roller.",
    both: [
      { n: "Slow belly breathing", rx: "1–2 min", q: "crocodile breathing exercise" },
      { n: "Foam roll, full body", rx: "3–5 min", q: "full body foam rolling routine follow along" },
    ],
  },
  {
    id: "mob",
    name: "Mobility (CARs: Controlled Articular Rotations)",
    time: "5–10 min",
    why: "<b>Joints get hurt at the edge of their range.</b> Think of an elbow in an armbar: it breaks when the force is more than the tissue can take. CARs are slow, full circles with each joint. They keep that edge healthy and show you where you're stiff. Think of it as brushing your teeth, but for joints.",
    tip: "Do CARs daily if you can, not just on lift days. The first time, use them as a self-check: note any side-to-side differences or pinching.",
    both: [
      { n: "Full-body CARs", rx: "1 slow rep each joint, each way", q: "full body CARs routine FRC controlled articular rotations" },
      { n: "PAILs / RAILs on your stiffest joint", tag: "optional", rx: "1–2 rounds", q: "PAILs RAILs 90 90 hip FRC" },
      { n: "End-range lift-offs / hovers", tag: "optional", rx: "3–5 reps", q: "FRC passive range hold lift off hip" },
    ],
  },
  {
    id: "pattern",
    name: "Pattern practice",
    time: "2 min",
    tag: "newer lifters",
    why: "<b>Tiny reps add up.</b> 5 bodyweight reps twice a week is about 500 extra reps a year. That's how squatting and hinging become automatic and clean.",
    d1: [
      { n: "Bodyweight squat", rx: "1×5", q: "bodyweight squat proper form" },
      { n: "Bodyweight split squat", rx: "1×5 ea", q: "bodyweight split squat form" },
    ],
    d2: [
      { n: "Bodyweight lateral squat", rx: "1×5 ea", q: "bodyweight lateral squat cossack form" },
      { n: "Bodyweight single-leg deadlift", rx: "1×5 ea", q: "bodyweight single leg RDL form" },
    ],
  },
  {
    id: "core",
    name: "Core",
    time: "~5 min",
    why: "<b>Your core is the bat.</b> Try hitting a baseball with a pool noodle: nothing happens. Your hips and legs make the power for a throw or sweep. A stiff core carries that power to your opponent. A floppy one leaks it. These exercises train you to <i>resist</i> movement, not create it.",
    d1: [
      { n: "Front plank", tag: "anti-extension", rx: "2×20–30s", q: "front plank proper form" },
      { n: "Anti-rotation (Pallof) press", tag: "anti-rotation", rx: "2×8 ea", q: "pallof press how to" },
    ],
    d2: [
      { n: "Side plank or Copenhagen plank", tag: "anti-side-bend", rx: "2×20s ea", q: "copenhagen plank progression" },
      { n: "Two-arm loaded carry", tag: "all directions", rx: "2×30–40 yd", q: "farmers carry proper form" },
    ],
  },
  {
    id: "warm",
    name: "Dynamic warm-up",
    time: "~8 min",
    why: "<b>More than getting sweaty.</b> Moving forward, backward, and sideways with different rhythms builds balance, coordination, and a sense of where your body is in space. That's the stuff that makes passing and guard play feel smooth.",
    tip: "Day 1 is forward/back. Day 2 is side-to-side. Don't swap this for 5 minutes on a bike scrolling your phone.",
    d1: [
      { n: "Knee hugs", rx: "10 yd", q: "walking knee hug warm up" },
      { n: "Heel to butt", rx: "10 yd", q: "walking quad pull heel to butt warm up" },
      { n: "Linear crawl", rx: "10 yd", q: "bear crawl forward" },
      { n: "Skips", rx: "20 yd", q: "A skip drill" },
      { n: "High knee run", rx: "20 yd", q: "high knees running drill" },
      { n: "Straight-leg high kicks", rx: "20 yd", q: "straight leg kicks frankenstein walk" },
      { n: "Straight-leg skips", rx: "20 yd", q: "straight leg skip drill" },
      { n: "Backpedal", rx: "20 yd", q: "backpedal drill form" },
      { n: "Backward run", rx: "20 yd", q: "backward running drill" },
    ],
    d2: [
      { n: "Leg cradles", rx: "10 yd", q: "walking leg cradle warm up" },
      { n: "Heel to butt with hinge", rx: "10 yd", q: "quad pull with hinge reach warm up" },
      { n: "Lateral crawl", rx: "10 yd ea way", q: "lateral bear crawl" },
      { n: "Lateral skips", rx: "20 yd ea way", q: "lateral skip drill" },
      { n: "Lateral shuffle", rx: "20 yd ea way", q: "lateral shuffle drill form" },
      { n: "Carioca", rx: "20 yd ea way", q: "carioca drill" },
    ],
  },
  {
    id: "power",
    name: "Speed & power",
    time: "~8 min",
    why: "<b>Power is strength, delivered fast.</b> It's what wins scrambles, finishes takedowns, and lets you jump on a submission before it's gone. It comes before the heavy lifting because you need to be fresh to be fast.",
    tip: "Few reps, full rest, maximum effort on every single rep. Form on sprints doesn't need to be perfect; intent is what counts. Older or newer to training? Skip sprints and use bike sprints (7–10s, 60–90s rest).",
    d1: [
      { n: "Sprint", rx: "10–20 yd · 2–3 reps total · 30–60s rest", q: "acceleration sprint start form" },
      { n: "Med ball chest pass", rx: "2–3×5 · 6–12 lb", q: "medicine ball chest pass explosive" },
      { n: "Box jump", tag: "2 feet → 2 feet", rx: "2–3×5", q: "box jump proper form landing" },
    ],
    d2: [
      { n: "Sprint", rx: "10–20 yd · 2–3 reps total · 30–60s rest", q: "acceleration sprint start form" },
      { n: "Med ball rotational toss", rx: "2–3×5 ea", q: "medicine ball rotational scoop toss" },
      { n: "Box hop", tag: "1 foot → same foot", rx: "2–3×5 ea", q: "single leg box hop" },
    ],
  },
  {
    id: "s1",
    name: "Strength A",
    time: "~12 min",
    ss: true,
    why: "<b>Strength makes every move cheaper.</b> If a sweep costs you less effort, you have more gas left and more calm to think. When two people have similar technique, the stronger one usually wins. Strength amplifies technique.",
    tip: "Superset: do a set of the first lift, then a set of the second, then rest. The two lifts use different muscles, so you get more done in less time.",
    note: "<b>Back injury swap:</b> the guide's trap bar deadlift is replaced with a hip thrust. Both train the same hip drive, but with your upper back on a bench, your spine carries no load. Go back to deadlifts only once your back is healed and a PT clears you.",
    d1: [
      { n: "Barbell hip thrust", tag: "hip drive", rx: STRENGTH, q: "barbell hip thrust proper form" },
      { n: "Push-up", tag: "push", rx: STRENGTH, q: "push up proper form scapula" },
    ],
    d2: [
      { n: "Zercher squat", tag: "squat", rx: STRENGTH, q: "zercher squat form" },
      { n: "Inverted TRX row", tag: "pull", rx: STRENGTH, q: "TRX inverted row form" },
    ],
  },
  {
    id: "s2",
    name: "Strength B",
    time: "~12 min",
    ss: true,
    note: "<b>Back injury swap:</b> the guide's single-leg deadlift is replaced with a single-leg hip thrust. Same hip work, no load on your spine.",
    why: "<b>Life happens one limb at a time.</b> In a roll you're rarely pushing evenly with both legs. Single-leg lifts are closer to the sport, and they get the same effect with far less weight, which is easier on your joints. You'll also notice more pulling than pushing: grapplers tend to hunch forward, so this balances you out.",
    d1: [
      { n: "Goblet split squat", tag: "single leg", rx: STRENGTH, ea: true, q: "goblet split squat form" },
      { n: "Chin-up", tag: "pull", rx: STRENGTH, q: "chin up proper form" },
    ],
    d2: [
      { n: "Single-leg hip thrust", tag: "single leg", rx: STRENGTH, ea: true, q: "single leg hip thrust bench form" },
      { n: "One-arm dumbbell row", tag: "pull", rx: STRENGTH, ea: true, q: "one arm dumbbell row form" },
    ],
  },
  {
    id: "cond",
    name: "Conditioning",
    time: "separate day",
    optional: true,
    why: "<b>Most people who roll a lot don't need this.</b> If you do add it, do it on a non-lifting day so you can truly go all out. It mimics a roll: burst, pause, burst again.",
    both: [
      {
        n: "Max-effort intervals (air bike or run)",
        rx: "20s all-out · 90s rest · ×3 · rest 8 min · repeat",
        q: "assault bike sprint intervals",
      },
    ],
  },
]

export function youtubeSearch(query: string) {
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(query)
}

export function strengthRx(week: WeekNumber, each?: boolean) {
  const w = WEEKS[week]
  return `${w.sets}×${w.reps}${each ? " ea" : ""} · RPE ${w.rpe}`
}

export function exerciseRx(exercise: Exercise, week: WeekNumber) {
  if (exercise.rx !== STRENGTH) return exercise.rx
  return strengthRx(week, exercise.ea)
}
