# Handoff: Money — full UI refresh (Nocturne dark)

## Overview

A complete visual and structural redesign of the **Money** expense-tracking app (Expo / React Native / expo-router, SQLite via `db-provider`). The app's data model, repositories and domain logic are **unchanged** — this handoff covers presentation and navigation only.

What changes:

1. **Theme** — light neobank palette → Nocturne dark (`#161826` ground, single blurple accent `#9184d9`, desaturated neutral ramps).
2. **Navigation** — 5 tabs → **4 tabs + a raised center FAB**. Settings moves out of the tab bar into a gear icon in the Home header.
3. **Home** — free balance becomes the hero; the two `SpeedometerGauge`s are replaced by **slim linear budget bars**.
4. **Add expense** — modal form → bottom sheet with a large inline amount, quick-amount chips, category pills and a numeric keypad.
5. **Settings** — one long scroll → a **hub of cards**, each opening its own page.
6. **History / Insights / Piggy Bank** — restyled onto the dark ramps; heatmap, composition bar and progress rings reworked.

## About the design files

The files in this bundle are **design references authored in HTML/CSS** — a running prototype of the intended look and behaviour. They are **not** production code to copy.

The task is to **recreate these screens in the existing Expo / React Native codebase**, using its established patterns: `constants/theme.ts` tokens, the `components/ui/*` primitives (`Card`, `Chip`, `ListRow`, `Button`, `TextField`, `BottomSheet`, `Text`), `expo-router` `Tabs`, `react-native-svg`, and `@expo/vector-icons`. Nothing here should introduce a web dependency.

Open `Money App.dc.html` in a browser to see and click through the prototype (tabs, FAB, sheets, keypad, settings hub, heatmap day sheets all work).

## Fidelity

**High fidelity.** Colors, type sizes, weights, radii, spacing and motion below are final and should be matched. Where the prototype uses a web-only affordance (`backdrop-filter`, `conic-gradient`, CSS keyframes), a React Native equivalent is given in "Platform notes".

---

## Design tokens

Replace the contents of `constants/theme.ts` with these values (same exported shape, so screens keep compiling).

### Color

| Token | Hex | Use |
| --- | --- | --- |
| `screenBg` | `#161826` | App ground, every screen |
| `surface` | `#1e2030` | Cards, rows, sheets |
| `surfaceRaised` | `#232532` | Chips, icon buttons, keypad keys |
| `surfaceSunken` | `#171927` | Progress-bar tracks, empty heat cells (`#1a1c2a`) |
| `ink` | `#e9e9ed` | Primary text |
| `inkStrong` | `#f3f5fe` | The balance figure only |
| `inkMuted` | `#75798c` | Secondary text |
| `inkFaint` | `#5d6172` | Tertiary / disabled text |
| `hairline` | `#2b2e3d` | Card borders |
| `hairlineStrong` | `#2f3243` | Raised-surface borders |
| `accent` | `#9184d9` | Accent base — lines, marks, active fills |
| `accent300` | `#d2cefd` | Accent text on dark tints |
| `accent400` | `#b5abfc` | Links, active icons |
| `accent700` | `#5d5294` | Outlined-button borders |
| `accent900` | `#2b2741` | Accent tinted fills (selected chip, toast) |
| `positive` | `#5FC49E` | Income, "ready to buy" |
| `danger` | `#d9848a` | Over budget, destructive |

Never pure black or pure white; all of the above come from the Nocturne ramps.

### Budget heat scale (replaces `heatColors`)

```ts
calm:     '#5d5294'   // < 50 %
building: '#9184d9'   // 50–89 %
hot:      '#d6b26a'   // 90–100 %
over:     '#d9848a'   // > 100 %
```

Track behind any bar: `#171927`. Bar height 6–7 px, fully rounded.

### Category colors (desaturated for the dark ground)

Groceries `#5FC49E` · Dining `#E0A15C` · Transport `#8391F5` · Home `#A78BFA` · Utilities `#D6C070` · Health `#E0787C` · Fun `#5FC2CE` · Shopping `#E07BB0`

Category avatars are the color at **13 % opacity** as the circle fill (`color + '22'`), with the icon glyph in the **full** color. Never a solid saturated circle.

### Spacing

`xs 8 · sm 12 · md 16 · lg 20 · xl 26 · xxl 40`. Screen horizontal padding **20**; sheet padding **18**.

### Radius

`sm 10 · md 12 · lg 14 · xl 16 · card 16 · sheet 26 (top only) · navBar 22 · pill 999`
Icon tiles: 38 px square at radius 13; 40 px at 13; 36 px at 12.

### Typography — Inter (already loaded via `@expo-google-fonts/inter`)

| Role | Size / line-height | Weight | Letter-spacing |
| --- | --- | --- | --- |
| Balance hero | 58 / 58 | 500 | −0.035em |
| Balance decimals | 24 | 400 | 0 |
| Screen title | 20 | 500 | −0.02em |
| Sheet title | 16 | 500 | −0.01em |
| Section header | 15 | 500 | −0.01em |
| Row title | 13.5 | 500 | 0 |
| Body / amount | 13–14 | 500 | 0 |
| Caption | 11.5 | 400 | 0 |
| Kicker (uppercase) | 10 | 500 | 0.16em |
| Tab label | 9.5 | 400 | 0.03em |

Never bolder than 500 — hierarchy is size and space. Every money figure uses tabular figures (`fontVariant: ['tabular-nums']`).

### Elevation

Dark-ground elevation is **an edge plus ambient darkness**, not a stack of shadows.
Cards: `backgroundColor: surface` + `1px` `hairline` border, no shadow.
FAB: `0 10px 26px rgba(93,82,148,.55)` + a 1px inner top highlight.
Sheet: `0 -24px 60px rgba(0,0,0,.5)`.

### Icons

**Phosphor**, not Ionicons — swap `@expo/vector-icons/Ionicons` for `phosphor-react-native`. Filled weight inside avatars and for active tab icons; regular weight for chrome and inactive tabs.

| Old (Ionicons) | New (Phosphor) |
| --- | --- |
| `cart` | `ShoppingCart` |
| `restaurant` | `ForkKnife` |
| `car` | `CarProfile` |
| `home` | `House` |
| `flash` | `Lightning` |
| `medkit` | `FirstAidKit` |
| `film` | `FilmSlate` |
| `gift` | `Gift` |
| `fitness` | `Barbell` |
| `school` | `GraduationCap` |
| `wifi` | `WifiHigh` |
| `pricetag` | `Tag` |
| `stats-chart` | `ChartDonut` |
| `calendar` | `CalendarBlank` |
| `wallet` | `PiggyBank` |
| `settings` | `GearSix` |
| `trash-outline` | `Trash` |
| `repeat` | `ArrowsClockwise` |

---

## Navigation

`app/(tabs)/_layout.tsx`:

- Four `Tabs.Screen`s in order: **Home** (`index`), **History**, **Insights**, **Goals** (`piggy-bank`, title changes to "Goals").
- `settings` becomes `href: null` in its tab options so the route stays but leaves the bar; it is pushed from the Home header gear.
- `headerShown: false` on every screen — each screen draws its own header.
- Custom `tabBar` renderer (the stock bar cannot hold the FAB):
  - Floating bar: height **62**, margin `0 14px 12px`, radius **22**, background `rgba(30,32,48,.92)`, 1px `#2f3243` border, `BlurView` intensity ~18 behind it.
  - Two tab items, a **74 px** spacer, two tab items.
  - FAB absolutely positioned, `left: 50%`, `top: -22`, 60×60, radius 22, gradient `155deg #a396ec → #6f61b8`, `Plus` glyph in `#171826` at 24. Tap opens the add-expense sheet (global — lift its state into a context or the tab layout).
  - Active tab: filled icon + label `#d2cefd`. Inactive: regular icon + label `#6b6f82`.
- Above the bar, screens pad their scroll content by **120** so nothing hides behind it.

---

## Screens

### 1. Home (`app/(tabs)/index.tsx`)

**Purpose:** answer "how much can I spend?" in under a second, and log an expense in two taps.

Layout, top to bottom:

1. **Header row** (`padding: 8px 20px 0`) — brand mark left: 26×26 radius-8 tile, gradient `150deg #9184d9 → #5d5294`, `Wallet` fill glyph 14 in `#171826`; label "Money" 14/500. Right: two 36×36 radius-12 buttons (`surfaceRaised`, 1px `#2f3243`) — `BellSimple` (alerts) and `GearSix` (pushes `/settings`).
2. **Balance hero** (`padding: 30px 20px 26px`, `overflow: hidden`) — behind it, a 320×220 radial glow `rgba(145,132,217,.30) → transparent`, centered, offset `top: -70`, breathing 6 s (opacity .55↔.85, scale 1↔1.08). In RN: an `expo-linear-gradient` radial substitute or a blurred `View`, animated with `withRepeat(withTiming(...))`.
   - Kicker "FREE BALANCE" 10/0.16em in `accent`.
   - Amount row, baseline-aligned: symbol 30/300 `#9397ab` · whole 58/500 `inkStrong` · `.cents` 24/400 `inkMuted`.
   - Meta row: a pill (`accent900` bg, `accent300` text, 11px, radius 999, `ArrowDownRight` fill) reading "`$1,113` this month", then "17 days left" 11.5 `inkMuted`.
   - Free balance = monthly income − fixed recurring − month spend (existing `calculateFreeBalance`).
3. **Budget bars card** (`margin: 0 20px`, padding `16 16 14`, radius 14, gradient `180deg #232532 → #1e2030`, 1px `#2f3243`, `gap: 14`). Two rows — **Today** and **This week**:
   - Label 12.5/500 `#cfd3e5` left; right `"$38 / $65"` 12px, spent in `inkMuted`, `/ target` in `#4d5162`.
   - Track: height 7, radius 999, `#171927`. Fill: heat color for the percentage, `box-shadow`/glow `color + '55'`, width animates 0→pct over 700 ms `cubic-bezier(.2,.8,.25,1)` on mount and on change.
   - Targets: daily = (income − fixed) / days-in-month, weekly = daily × 7 (existing `getDailyBudgetTarget`).
   - **This replaces `components/gauge.tsx` entirely** — delete `SpeedometerGauge`.
4. **Quick-log chip rail** — horizontal scroll, `padding: 0 20px`, `gap: 8`. Chip: radius 999, `surfaceRaised`, 1px `#2f3243`, padding `8 13 8 8`; 24 px tinted avatar + name 12.5 `#cfd3e5`. Tap opens the add sheet **with that category preselected**.
5. **Recent** — header row "Recent" 15/500 + "All activity" 12 `accent400` (→ History tab). Rows: 38 px tinted avatar tile (radius 13), title 13.5/500, subtitle 11.5 `inkMuted` = `note · Today | 12 Aug`, amount 14/500 right, prefixed `-`. Row padding `11 10`, radius 12, pressed state `rgba(145,132,217,.10)`. Six rows max.

### 2. History (`app/(tabs)/history.tsx`)

- **Month header:** 34 px radius-11 caret buttons either side; center column = month + year 16/500 with "`$1,113` spent" 11 `inkMuted` beneath.
- **Heatmap card:** `margin: 0 16px`, padding `16 14`, radius 16, `surface`, 1px `hairline`.
  - Weekday letters 10px `#5d6172`, 7-column grid, `gap: 6`.
  - Cells: `aspect-ratio: 1`, radius 10. No spend → bg `#1a1c2a`, border `#232535`, number `#4d5162`. Spend → bg `heat + '26'` (or `'3d'` at ≥90 %), border `heat + '3a'`, number `#e4e7f5`, plus a **3 px dot** in the full heat color under the number. Today → 1px `accent` border.
  - Legend: "Calm" · four 5 px bars (`#1a1c2a`, `#5d5294`, `#9184d9`, `#d9848a`) · "Over".
  - Replaces the current `month-heatmap.tsx` styling; the `dayData` prop contract is unchanged.
- **Stat trio:** three equal cards (`gap: 10`, padding `13 12`, radius 14) — Spent · Avg / day · Over days. Kicker 9.5/0.12em uppercase `#5d6172`, value 17/500; "Over days" value in `danger`.
- **This month list:** same row spec as Home's Recent, full month, newest first. Tapping a row or a heat cell opens the **day sheet**.

### 3. Insights (`app/(tabs)/insights.tsx`)

- Title "Insights" 20/500 + a segmented pill right: container radius 999, `surface`, 1px `hairline`, 3 px padding; options padding `6 14`, radius 999; selected = `accent900` bg + `accent300` text, unselected `inkMuted`.
- **Period card:** margin 20, padding 18, radius 16, gradient `180deg #232532 → #1c1e2c`, 1px `#2f3243`. Kicker "THIS MONTH SPEND"; figure 34/500; "of $2,700 budgeted" 12 `inkMuted`.
  - **Composition bar:** 9 px tall row of segments, `gap: 3`, radius 3, each flexed by its category's spend, in the category color; top 5 categories. Legend below: 7 px swatch + name 11 `#9397ab`.
- **By category:** one card per category (padding 14, radius 14, `surface`, 1px `hairline`, `gap: 11`), sorted by spend desc.
  - Header: 32 px tinted avatar (radius 11) · name 13.5/500 · right `"$284 / $420"` (limit in `#5d6172`) or `"$96 · no limit"`.
  - Bar row: 6 px track + heat fill, then a 38 px right-aligned percentage 11px — `danger` at ≥90 %, else `inkMuted`. `—` when no limit.
  - Cards stagger in with a 14 px rise + fade, 400 ms.
- Week period scales monthly limits by 7/31 and filters to the current week (existing `getPeriodSpend` / `currentWeekRange`).

### 4. Goals (`app/(tabs)/piggy-bank.tsx`)

- Header: "Piggy banks" 20/500 with "`$1,290` saved across 3 goals" 11.5 `inkMuted`; right an outlined **New** button (padding `9 14`, radius 999, 1px `accent700`, bg `rgba(145,132,217,.10)`, `Plus` + label `accent300`) — Nocturne primary actions are outlined, never filled.
- **Goal card** (padding 16, radius 16, 1px `hairline`, `gap: 16`), one per row, not a 2-up grid:
  - 62 px **progress ring** — in RN keep `components/progress-ring.tsx` (`react-native-svg`), stroke 5, track `#262938`, progress `accent` (or `positive` when complete), rounded cap, animated sweep 600 ms. Center label = percentage 13/500 in the ring color on a `#1b1d2b` disc.
  - Name 14.5/500 · "`$312` of `$399`" 12 (`of $399` in `#5d6172`) · status line 11: "`$87` to go" `#5d6172`, or "Ready to buy" `positive`.
  - Complete goals: card bg gradient `150deg #1f2a2b → #1b1d2b`, border `#33564d`, ring `positive`.
  - Trailing `CaretRight` 15 `#4d5162`. Tap → **add-funds sheet** (replaces the current `Alert.alert` action list — no more system alerts anywhere in this app).

### 5. Settings — hub (`app/settings/index.tsx`)

Pushed as its own route (not a tab). Sticky header: 36 px back button + "Settings" 18/500.

- **Plan card** at top: padding 16, radius 16, gradient `150deg #2b2741 → #1e2030`, 1px `#3a3556`; 44 px accent-tinted avatar with `User`; "Monthly plan" 14/500; "`$4,200` income · `$1,500` fixed" 11.5 `#9397ab`.
- **Five section cards** (padding 15, radius 16, `surface`, 1px `hairline`, `gap: 13`): 40 px tinted avatar · title 13.5/500 + subtitle 11.5 `inkMuted` · count 11 `#5d6172` · `CaretRight`.

| Card | Subtitle | Icon / color | Route |
| --- | --- | --- | --- |
| Income | Salary, bonuses, repeats | `Bank` `#5FC49E` | `/settings/income` |
| Categories | Limits, icons and colours | `SquaresFour` `#A78BFA` | `/settings/categories` |
| Recurring payments | Rent, subscriptions, bills | `ArrowsClockwise` `#8391F5` | `/settings/recurring` |
| Alerts | Threshold nudges per category | `BellSimple` `#E0A15C` | `/settings/alerts` |
| Developer tools | App clock, recurring check | `Wrench` `#75798c` | `/settings/dev` |

### 6. Settings — section page (`app/settings/[section].tsx`)

One shared layout, driven by section:

- Back button + section title in the sticky header.
- A one-sentence blurb, 12.5/1.5 `inkMuted`, max-width ~300.
- Rows: padding `13 14`, radius 14, `surface`, 1px `hairline`, `gap: 12` — 36 px tinted avatar · title 13/500 + subtitle 11 `inkMuted` · value 13 tabular `#cfd3e5` · a 30 px radius-10 `#242636` delete button with `Trash` 14 in `#8d6b76`. Rows rise-in 340 ms, staggered.
- Footer: a **dashed** add button — padding 13, radius 14, 1px dashed `#4a4d63`, `Plus` + label in `accent300` ("Add income", "New category", "Add recurring payment", "New alert", "Run recurring check").
- The existing `BottomSheet` + `TextField` + `Chip` create/edit forms are reused, restyled to the sheet spec below. The prototype stubs these — build them from the current `settings.tsx` logic, which is otherwise unchanged.

---

## Sheets

All sheets: pinned bottom, radius **26** top corners, bg `#1c1e2c`, 1px top border `#343751`, shadow `0 -24px 60px rgba(0,0,0,.5)`, padding `10 18 18`, a 38×4 `#3f424d` grab handle centered with 14 px below. Backdrop `rgba(9,10,17,.62)`, tap to dismiss. Enter: slide from 105 % over **340 ms** `cubic-bezier(.2,.85,.3,1)`; backdrop fades 220 ms.

### Add expense (FAB, quick chip, day sheet, and "+" all route here)

1. Title row: "New expense" 15/500 + a 30 px `#252838` close button.
2. **Amount display**, centered, padding `22 0 6`: symbol 24/300 `inkMuted` · value 52/500 tabular — `#4d5162` while empty (shows `0`), `inkStrong` once typed — plus a 2×40 accent caret blinking 1 s.
3. **Quick amounts** `+5 +10 +20 +50`: padding `6 13`, radius 999, `#252838`, 1px `#33364a`, 12px `#cfd3e5`. Adds to the current value.
4. **Category pills**, horizontal scroll: unselected `#232532` / 1px `#2f3243` / label `#9397ab`; selected `accent900` / 1px `accent700` / label `#e7e5fe`.
5. **Keypad**: 3×4 grid, `gap: 8`, keys 46 px tall, radius 14, `#232532`, 1px `#2e3143`, glyph 19px. Order `1–9`, `.`, `0`, `⌫`. Rules: one decimal point, max 2 decimals, max 7 chars.
6. **Save**: 52 px, radius 16, `CheckCircle` + label. Enabled → bg `rgba(145,132,217,.14)`, 1px `#6d61a8`, text `accent300`. Disabled → bg `#212433`, 1px `#2e3143`, text `#5d6172`. Label becomes "Save to 12 Aug" when logging retroactively from the day sheet.
7. On save: write via `logExpense`, close, and show a toast.

### Day detail (heatmap cell / row tap)

Title "14 August 2026" 16/500 + "3 expenses" 11.5 `inkMuted`; right, the day total 20/500 in that day's heat color. Scrollable rows (max ~280 px) at 36 px avatars. Footer: outlined "Add to this day" (48 px, radius 16, 1px `accent700`, `rgba(145,132,217,.10)`).

### Add funds (goal tap)

Same amount display + quick chips + keypad, 44 px keys. Title "Add funds — Sony WH-1000XM6". Confirm button: `PiggyBank` glyph + "Move to goal". Writes through `recordTransaction`.

### Toast

Replaces every `Alert.alert` used for confirmation. Pinned `left/right: 20`, `bottom: 96`, padding `13 16`, radius 14, bg `accent900`, 1px `#4a4370`, `CheckCircle` `accent400` + text 12.5 `#e7e5fe`. Enters with an 8 px rise + scale .96→1 over 300 ms; auto-dismisses at **2.2 s**. Copy: "$24.00 logged to Dining", "$50 moved to your goal", "Removed Spotify".

Destructive confirmations (delete a category, cancel a goal) keep a real dialog, styled as a centered sheet — not the OS alert.

---

## Interactions & motion

Motion brief: **expressive but short** — nothing over 700 ms, everything on `cubic-bezier(.2,.8,.25,1)` (RN: `Easing.bezier(.2,.8,.25,1)`), springs `damping 0.8 / stiffness medium-low`.

| Moment | Spec |
| --- | --- |
| Screen change | 10 px rise + fade + scale .995→1, 340 ms |
| Budget bar fill | scaleX 0→1 on mount, 700 ms; width transitions 500 ms on data change |
| Balance glow | opacity .55↔.85, scale 1↔1.08, 6 s, infinite, ease-in-out |
| Sheet in | translateY 105 %→0, 340 ms `cubic-bezier(.2,.85,.3,1)`; backdrop fade 220 ms |
| Any tap target | scale to .955 while pressed, 160 ms (`Pressable` + `Animated`) |
| Row press | background → `rgba(145,132,217,.10)`, 180 ms |
| List / card entry | 14 px rise + fade, 400 ms, ~40 ms stagger |
| Composition + insight bars | scaleX 0→1, 600–700 ms |
| Toast | 8 px rise + scale .96→1, 300 ms; out after 2.2 s |
| Goal ring | sweep to target percentage, 600 ms |

Add a haptic on: FAB press (`ImpactFeedbackStyle.Medium`), save success (`NotificationFeedbackType.Success`), keypad key (`Selection`), tab change (`Selection`).

Honour Reduce Motion: drop the glow loop and the springs, keep a 200 ms cross-fade.

---

## State

No new persistence. Screen-level state only:

- `tab` — owned by the router.
- `sheet: null | 'add' | 'day' | 'goal'` — **lift into the tab layout** (or a small context), because the FAB lives in the tab bar and the sheet must open over any screen.
- `amount: string` — keypad buffer; parse with `Number()` on save.
- `catId: number` — preselected by the chip rail, defaults to the first category.
- `day: string | null` — ISO date; when set, the add sheet saves retroactively to it.
- `goalId: number | null` — for the add-funds sheet.
- `period: 'week' | 'month'` — Insights segmented control.
- `viewYear` / `viewMonth` — History, unchanged.
- `toast: string | null` — with a 2.2 s timer, cleared on unmount.

Data loading keeps the existing `useFocusEffect(load)` pattern and repository calls. Reconciliation prompts (`resolveDeficitOrSweep`) move from `Alert.alert` to the styled dialog, same logic.

## Platform notes (web → React Native)

| Prototype uses | React Native equivalent |
| --- | --- |
| `backdrop-filter: blur` on the tab bar | `expo-blur` `<BlurView intensity={18} tint="dark">` under a translucent `View` |
| `conic-gradient` goal ring | keep `components/progress-ring.tsx` (`react-native-svg` `Circle` + `strokeDasharray`) |
| `linear-gradient` cards / FAB | `expo-linear-gradient` |
| Radial glow behind the balance | a large `LinearGradient` circle at low opacity, or a soft PNG; animate with `react-native-reanimated` |
| CSS `@keyframes` | `react-native-reanimated` (`withTiming`, `withRepeat`, `withSpring`) |
| `aspect-ratio` heat cells | supported in RN 0.71+ |
| `font-feature-settings: 'tnum'` | `fontVariant: ['tabular-nums']` |
| `:active` scale | `Pressable` + `Animated.spring` on `scale` |

Status bar: `light` content on the `#161826` ground; enable edge-to-edge and pad the header by the top inset, the tab bar by the bottom inset.

## Accessibility

- Every tap target ≥ 44 px — the 30/34/36 px visual buttons need `hitSlop`.
- Keep the existing `accessibilityLabel`s (balance summary, category progress, goal progress); update the tab bar labels and give the FAB "Add expense".
- Contrast: `inkMuted #75798c` on `#161826` is ~4.4:1 — fine at 11.5 px+ for secondary text; do not use `inkFaint #5d6172` for anything a user must read. Accent on ground is ~3.4:1 — icons, large text and chrome only, never body copy (use `accent300` there).
- Card faces and money figures should not reflow at large font scales: cap `fontScale` on the balance hero and the keypad only; everything else scales.

## Assets

No image assets. Icons are Phosphor (`phosphor-react-native`, MIT). Type is Inter, already in the project. No new brand assets — the wallet mark in the header is a gradient tile plus the Phosphor `Wallet` glyph.

## Files in this bundle

- `Money App.dc.html` — the interactive prototype (open in any browser; all tabs, sheets and the keypad work).
- `android-frame.jsx` — the Android device bezel the prototype renders inside. Reference only, not part of the design.
- `_ds/nocturne-.../styles.css` — the Nocturne token sheet the palette above is drawn from.
- `_ds/nocturne-.../readme.md` — the design system's own guidance (accent as line-and-glow, outlined actions, no saturated floods, 500 weight ceiling). Worth reading before improvising anything not covered here.

## Suggested implementation order

1. `constants/theme.ts` — new tokens (the whole app shifts on this one commit).
2. `components/ui/*` — restyle `Card`, `Chip`, `ListRow`, `Button`, `TextField`, `BottomSheet`, `Text`; swap Ionicons → Phosphor.
3. `(tabs)/_layout.tsx` — 4 tabs, custom bar, FAB, shared sheet state.
4. Home — hero, budget bars (delete `gauge.tsx`), chip rail, recent list.
5. Add-expense sheet + toast (this is where the app stops feeling basic).
6. History heatmap + day sheet.
7. Insights composition + category cards.
8. Goals cards + add-funds sheet.
9. Settings hub + section pages, reusing the existing forms.
