"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Info, Play } from "lucide-react"
import { UserNav } from "@/components/user-nav"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  BLOCKS,
  WEEKS,
  exerciseRx,
  youtubeSearch,
  type DayNumber,
  type WeekNumber,
} from "@/lib/bjj-routine"

const STORAGE = {
  day: "bjj-day",
  week: "bjj-week",
  done: "bjj-done",
}

function readStore(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore private-mode / blocked storage.
  }
}

function Html({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

function CycleGuide({ week }: { week: WeekNumber }) {
  return (
    <>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Why train everything, every session</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            In one roll you might need flexibility to keep guard, strength to sweep, and speed to
            wrestle up. You don&apos;t get to choose. So every session touches every quality a
            little. If you spent a month on only one, the others would fade.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Strength sets by week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            This applies to the strength blocks (7 and 8). Pick a week on the routine to switch.
            Week 1 is the easy week on purpose: you learn the moves and recover. Week 4 is
            &quot;send it&quot; week.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-slate-100">Week</TableHead>
                <TableHead className="bg-slate-100">Sets × reps</TableHead>
                <TableHead className="bg-slate-100">Effort (RPE)</TableHead>
                <TableHead className="bg-slate-100">Reps left in tank</TableHead>
                <TableHead className="bg-slate-100">Weight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(Object.entries(WEEKS) as [string, (typeof WEEKS)[WeekNumber]][]).map(
                ([key, value]) => (
                  <TableRow
                    key={key}
                    className={Number(key) === week ? "bg-[#FEF3ED] hover:bg-[#FEF3ED]" : undefined}
                  >
                    <TableCell>
                      {key} · {value.label}
                    </TableCell>
                    <TableCell>
                      {value.sets}×{value.reps}
                    </TableCell>
                    <TableCell>{value.rpe}/10</TableCell>
                    <TableCell>{value.rir}</TableCell>
                    <TableCell>{value.w}</TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">How heavy? Use &quot;reps left in the tank&quot;</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            RPE is a 1–10 score for how hard a set felt. The easier way to think about it: when you
            finish the set, how many more clean reps could you have done? That number should be 0–3.
            If you could do 5 or 10 more, it&apos;s too light.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>During the set, ask: does it look clean? Is the last rep as fast as the first?</li>
            <li>
              After the set, ask: how hard was that out of 10? How many more good reps did I have?
            </li>
            <li>
              Bad day? Drop the weight. Skipping a heavy week won&apos;t cost you your gains.
              Consistency wins.
            </li>
            <li>Only add weight to a movement that already looks good.</li>
          </ul>
          <p className="text-muted-foreground">
            Guide&apos;s example: trap bar deadlift (lbs) · same pattern applies to your hip thrust
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-slate-100">Week</TableHead>
                <TableHead className="bg-slate-100">Month 1</TableHead>
                <TableHead className="bg-slate-100">Month 2</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>1 · 2×10</TableCell>
                <TableCell>205, 225</TableCell>
                <TableCell>235, 235</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>2 · 3×8</TableCell>
                <TableCell>235, 245, 245</TableCell>
                <TableCell>245, 255, 255</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>3 · 3×6</TableCell>
                <TableCell>275, 275, 275</TableCell>
                <TableCell>295, 305, 305</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>4 · 3×4</TableCell>
                <TableCell>295, 305, 315</TableCell>
                <TableCell>315, 325, 335</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-muted-foreground border-l-2 border-[#F15A1B] pl-3">
            Think inchworm. Each month starts a little heavier than the last one did.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Tempo: how fast each rep moves</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Tempo is written as four numbers. Example push-up at <strong>1.3.X.1</strong>:
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="border rounded-lg bg-slate-50 p-3">
              <p className="text-2xl font-medium">1</p>
              <p className="text-muted-foreground">sec down</p>
            </div>
            <div className="border rounded-lg bg-slate-50 p-3">
              <p className="text-2xl font-medium">3</p>
              <p className="text-muted-foreground">sec hold at bottom</p>
            </div>
            <div className="border rounded-lg bg-slate-50 p-3">
              <p className="text-2xl font-medium">X</p>
              <p className="text-muted-foreground">explode up</p>
            </div>
            <div className="border rounded-lg bg-slate-50 p-3">
              <p className="text-2xl font-medium">1</p>
              <p className="text-muted-foreground">sec hold at top</p>
            </div>
          </div>
          <p>Change the focus each month:</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-slate-100">Month</TableHead>
                <TableHead className="bg-slate-100">Focus</TableHead>
                <TableHead className="bg-slate-100">What it does for you</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>1</TableCell>
                <TableCell>Pauses (isometric)</TableCell>
                <TableCell className="whitespace-normal">
                  Teaches positions. Builds the strength to hold a pin or squeeze a choke.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>2</TableCell>
                <TableCell>Slow lowering (eccentric)</TableCell>
                <TableCell className="whitespace-normal">
                  Teaches your body to absorb force. Most injuries happen while absorbing force.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>3</TableCell>
                <TableCell>Normal lifting (concentric)</TableCell>
                <TableCell className="whitespace-normal">
                  Drop the pauses. Focus on producing force.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>4</TableCell>
                <TableCell>Fast (dynamic)</TableCell>
                <TableCell className="whitespace-normal">
                  Lighter, explosive versions of the same lifts, moved as fast as you can with good
                  form.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-muted-foreground border-l-2 border-[#F15A1B] pl-3">
            Before a tournament, try &quot;iso-explode&quot;: hold a position 5–10 sec, then do 5–8
            explosive reps right away. It mimics the stall-then-scramble rhythm of a match.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Swap ladders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Every lift sits on a ladder from easy to hard. Hurt, tired, or bored? Move one rung up,
            down, or sideways. Same training effect, different exercise.
          </p>
          <p className="text-muted-foreground">Split squat</p>
          <p>Assisted → Bodyweight → Goblet → Goblet, back foot up → Single-leg squat</p>
          <p className="text-muted-foreground">Loaded carry</p>
          <p>
            Goblet → Two-arm → One-arm → One-arm, shaky load → One-arm front rack → One-arm overhead
          </p>
          <p>
            Back cranky from rolling? Keep the hip-hinge pattern but take the load off your spine:
            swap the deadlift for a hip lift (glute bridge).
          </p>
          <p>
            <strong>Make a lift harder without changing it:</strong> more weight, slower tempo, a
            different tool (dumbbell vs. kettlebell), hold the load somewhere else, change your
            stance, tire the muscle first, or shorten rest.
          </p>
          <p>
            <strong>Rules for moving up:</strong> simple before complex, more contact points before
            fewer, slow before fast, still before moving, light before heavy, even load before
            lopsided, load close to your body before far away. Spend about a month on each rung.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Competition week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>
            Keep training normally until tournament week. That week, do your first lift as usual. On
            the second lift, only do blocks 1–6 (everything up through speed &amp; power). Skip the
            heavy strength. Speed fades in about 4–5 days, so this keeps you sharp without leaving
            you sore.
          </p>
          <p className="text-muted-foreground border-l-2 border-[#F15A1B] pl-3">
            Advanced option, &quot;contrast&quot; sets: 3 heavy hip thrusts, then 5 max jumps right
            after. The heavy set wakes up extra muscle for a short window, and the jumps use it. Save
            this until your back is fully healed.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">If you get hurt</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            See a professional, ideally a PT who wants to get you back on the mats. Then keep
            training whatever doesn&apos;t hurt. Training one side makes the other side stronger too
            (the &quot;crossover effect&quot;), and moving brings blood to the injured spot.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Log everything</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Write down every set, rep, and weight. A notes app, a spreadsheet, or TrainHeroic all
            work. If you don&apos;t track it, you&apos;ll guess next week, and guessing is how
            progress stalls.
          </p>
        </CardContent>
      </Card>
    </>
  )
}

export default function BjjPage() {
  const [day, setDay] = useState<DayNumber>(1)
  const [week, setWeek] = useState<WeekNumber>(1)
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [openBlocks, setOpenBlocks] = useState<string[]>(() => BLOCKS.map((block) => block.id))

  function openIncomplete(doneMap: Record<string, boolean>, forDay: DayNumber) {
    setOpenBlocks(
      BLOCKS.filter((block) => !doneMap[`${forDay}-${block.id}`]).map((block) => block.id)
    )
  }

  useEffect(() => {
    const savedDay = Number(readStore(STORAGE.day))
    const savedWeek = Number(readStore(STORAGE.week))
    const loadedDay: DayNumber = savedDay === 1 || savedDay === 2 ? savedDay : 1
    if (loadedDay !== 1) setDay(loadedDay)
    if (savedWeek === 1 || savedWeek === 2 || savedWeek === 3 || savedWeek === 4) {
      setWeek(savedWeek)
    }
    let loadedDone: Record<string, boolean> = {}
    try {
      loadedDone = JSON.parse(readStore(STORAGE.done) || "{}")
    } catch {
      loadedDone = {}
    }
    setDone(loadedDone)
    openIncomplete(loadedDone, loadedDay)
  }, [])

  const weekInfo = WEEKS[week]

  const { count, total, numbered } = useMemo(() => {
    let n = 0
    let completed = 0
    let required = 0
    const numbers: Record<string, number | "+"> = {}
    for (const block of BLOCKS) {
      const key = `${day}-${block.id}`
      if (block.optional) {
        numbers[block.id] = "+"
      } else {
        n += 1
        required += 1
        numbers[block.id] = n
        if (done[key]) completed += 1
      }
    }
    return { count: completed, total: required, numbered: numbers }
  }, [day, done])

  function selectDay(next: DayNumber) {
    setDay(next)
    writeStore(STORAGE.day, String(next))
    openIncomplete(done, next)
  }

  function selectWeek(next: WeekNumber) {
    setWeek(next)
    writeStore(STORAGE.week, String(next))
  }

  function toggleDone(key: string, checked: boolean) {
    const next = { ...done, [key]: checked }
    if (!checked) delete next[key]
    setDone(next)
    writeStore(STORAGE.done, JSON.stringify(next))
    const blockId = key.slice(key.indexOf("-") + 1)
    setOpenBlocks((prev) => {
      if (checked) return prev.filter((id) => id !== blockId)
      return prev.includes(blockId) ? prev : [...prev, blockId]
    })
  }

  function clearChecks() {
    const next = { ...done }
    for (const key of Object.keys(next)) {
      if (key.startsWith(`${day}-`)) delete next[key]
    }
    setDone(next)
    writeStore(STORAGE.done, JSON.stringify(next))
    setOpenBlocks(BLOCKS.map((block) => block.id))
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl pb-32">
      <div className="flex justify-between items-start mb-8">
        <div className="flex-shrink-0">
          <Link href="/calories" className="hover:opacity-80 transition-opacity inline-block">
            <Image
              src="/lazylifts-logo.png"
              alt="Lazy Lifts"
              width={200}
              height={84}
              className="h-auto max-h-[84px] w-auto max-w-[200px]"
              priority
            />
          </Link>
        </div>
        <UserNav />
      </div>

      <div className="mb-6">
        <p className="text-muted-foreground text-lg tracking-wide mb-1">
          2 lifts a week · built for grapplers
        </p>
        <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-medium flex items-center gap-2">
            BJJ Strength Routine
            <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:text-foreground"
                aria-label="About this routine"
              >
                <Info className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="bottom"
              className="z-[100] w-80 sm:w-96 text-base font-normal"
            >
              <p className="mb-3">
                Two strength sessions a week, done in the same order every time. Pick the day, pick
                the week of the month, then work top to bottom. Each block tells you why it&apos;s
                there.
              </p>
              <div className="space-y-3">
                <div>
                  <p className="font-medium mb-0.5">2x a week is enough</p>
                  <p className="text-muted-foreground">
                    Most grapplers who roll 4–6 times a week only lift twice. Recovery is what makes
                    you better, not more sessions.
                  </p>
                </div>
                <div>
                  <p className="font-medium mb-0.5">Pinch = stop</p>
                  <p className="text-muted-foreground">
                    If a joint feels pinchy at the end of a movement, don&apos;t push into it. Go
                    around it and note it.
                  </p>
                </div>
                <div>
                  <p className="font-medium mb-0.5">No exercise is mandatory</p>
                  <p className="text-muted-foreground">
                    If a lift hurts, swap it for one that trains the same pattern. See &quot;Swap
                    ladders&quot; in Part 2.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="link" className="px-0 h-auto text-base">
                Part 2
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-2xl font-medium">The 4-week cycle</DialogTitle>
                <DialogDescription className="text-base">
                  Part 2 · how it changes week to week
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto space-y-4 pr-1">
                <CycleGuide week={week} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="sticky top-0 z-[1] bg-background py-3 mb-4 border-b flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2" role="group" aria-label="Training day">
          <Button
            type="button"
            variant={day === 1 ? "default" : "outline"}
            onClick={() => selectDay(1)}
            aria-pressed={day === 1}
          >
            Day 1 linear
          </Button>
          <Button
            type="button"
            variant={day === 2 ? "default" : "outline"}
            onClick={() => selectDay(2)}
            aria-pressed={day === 2}
          >
            Day 2 lateral
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="group" aria-label="Week of the month">
            {([1, 2, 3, 4] as WeekNumber[]).map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={week === n ? "default" : "outline"}
                aria-label={`Week ${n}`}
                aria-pressed={week === n}
                onClick={() => selectWeek(n)}
              >
                Wk {n}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-base">
            {weekInfo.label} · {weekInfo.sets}×{weekInfo.reps} @ RPE {weekInfo.rpe}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <p className="text-muted-foreground">
          Day {day}: {count} of {total} blocks done
        </p>
        <div className="flex-1 min-w-[120px] h-2 bg-slate-100 rounded overflow-hidden">
          <div
            className="h-full bg-[#F15A1B] transition-all"
            style={{ width: `${total ? (count / total) * 100 : 0}%` }}
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={clearChecks}>
          Clear checks
        </Button>
      </div>

      <Accordion
        type="multiple"
        value={openBlocks}
        onValueChange={setOpenBlocks}
        className="space-y-4 mb-8"
      >
        {BLOCKS.map((block) => {
          const items = block.both ?? (day === 1 ? block.d1 : block.d2) ?? []
          const key = `${day}-${block.id}`
          const checked = Boolean(done[key])
          return (
            <AccordionItem
              key={block.id}
              value={block.id}
              className={cn(
                "border-b-0 border rounded-lg px-4",
                block.optional && "border-dashed",
                checked && "opacity-60"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <AccordionTrigger className="hover:no-underline text-left py-4">
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl font-medium text-[#F15A1B] min-w-8">
                        {numbered[block.id]}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-muted-foreground font-normal">
                          {block.time}
                          {block.tag ? ` · ${block.tag}` : ""}
                          {block.optional ? " · optional" : ""}
                        </span>
                        <span className="block text-xl font-medium">{block.name}</span>
                      </span>
                    </span>
                  </AccordionTrigger>
                </div>
                <label
                  className="flex items-center gap-2 text-muted-foreground cursor-pointer whitespace-nowrap shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="h-[18px] w-[18px] accent-[#F15A1B]"
                    checked={checked}
                    onChange={(e) => toggleDone(key, e.target.checked)}
                  />
                  Done
                </label>
              </div>
              <AccordionContent className="text-base space-y-3">
                <p>
                  <Html html={block.why} />
                </p>
                {block.tip ? (
                  <p className="text-muted-foreground border-l-2 border-[#F15A1B] pl-3">
                    {block.tip}
                  </p>
                ) : null}
                {block.note ? (
                  <p className="bg-slate-50 border rounded-md p-3">
                    <Html html={block.note} />
                  </p>
                ) : null}
                {block.ss ? (
                  <Badge variant="secondary" className="font-medium">
                    Superset · alternate, then rest
                  </Badge>
                ) : null}
                <Table>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.n}>
                        <TableCell className="pl-0">
                          <span className="font-medium">{item.n}</span>
                          {item.tag ? (
                            <span className="text-muted-foreground ml-2">{item.tag}</span>
                          ) : null}
                          <div>
                            <a
                              href={youtubeSearch(item.q)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-base"
                            >
                              <Play className="h-3 w-3 fill-current" />
                              Watch demo
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-0 whitespace-nowrap text-muted-foreground">
                          {exerciseRx(item, week)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>


      <p className="mt-10 text-muted-foreground">
        Based on &quot;The Definitive Guide to Strength Training for BJJ&quot; (Parts 1 &amp; 2) by
        the owner of Victory Submission Strength, posted on{" "}
        <a
          href="https://www.reddit.com/r/bjj/comments/18444zt/the_definitive_guide_to_strength_training_for_bjj/"
          target="_blank"
          rel="noopener noreferrer"
        >
          r/bjj
        </a>
        . Core and pattern-practice set counts are starting points, since the guide doesn&apos;t
        specify them. Demo links open a YouTube search for each exercise.
      </p>
    </div>
  )
}
