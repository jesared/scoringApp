import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { Expand, History, RotateCcw, Settings } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "scoring-state-v1"

type Screen = "setup" | "score"

type Player = {
  name: string
  total: number
  current: number
}

type HistoryEntry = {
  round: number
  entries: Array<{
    name: string
    delta: number
    total: number
  }>
  createdAt: string
}

type ScoreState = {
  screen: Screen
  count: number
  round: number
  history: HistoryEntry[]
  players: Player[]
}

const playerAccents = [
  "hsl(176 78% 48%)",
  "hsl(355 100% 64%)",
  "hsl(35 100% 52%)",
  "hsl(214 100% 58%)",
  "hsl(263 93% 68%)",
  "hsl(139 65% 54%)",
]

function createDefaultState(count = 4): ScoreState {
  return {
    screen: "setup",
    count,
    round: 1,
    history: [],
    players: Array.from({ length: count }, (_, index) => ({
      name: `Joueur ${index + 1}`,
      total: 0,
      current: 0,
    })),
  }
}

function clampPlayerCount(value: unknown) {
  return Math.min(6, Math.max(1, Number.parseInt(String(value), 10) || 1))
}

function normalizePlayer(player: Partial<Player> & { score?: number }, index: number): Player {
  return {
    name: String(player.name || `Joueur ${index + 1}`),
    total: Number.isFinite(player.total) ? Number(player.total) : Number(player.score) || 0,
    current: Number.isFinite(player.current) ? Number(player.current) : 0,
  }
}

function loadState(): ScoreState {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<ScoreState> | null

    if (!stored || !Array.isArray(stored.players)) {
      return createDefaultState()
    }

    const count = clampPlayerCount(stored.count)
    const players = stored.players.slice(0, count).map(normalizePlayer)

    return {
      screen: stored.screen === "score" ? "score" : "setup",
      count,
      round: Math.max(1, Number.parseInt(String(stored.round), 10) || 1),
      history: Array.isArray(stored.history) ? stored.history : [],
      players,
    }
  } catch {
    return createDefaultState()
  }
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

export default function App() {
  const [state, setState] = useState<ScoreState>(() => loadState())
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    void clearLegacyServiceWorker()
  }, [])

  const hasCurrentScore = useMemo(
    () => state.players.some((player) => player.current !== 0),
    [state.players],
  )

  function updatePlayerCount(count: number) {
    setState((current) => {
      const nextCount = clampPlayerCount(count)
      const players = Array.from({ length: nextCount }, (_, index) => {
        return current.players[index] ?? {
          name: `Joueur ${index + 1}`,
          total: 0,
          current: 0,
        }
      })

      return {
        ...current,
        count: nextCount,
        players,
      }
    })
  }

  function updatePlayerName(index: number, name: string) {
    setState((current) => ({
      ...current,
      players: current.players.map((player, playerIndex) =>
        playerIndex === index ? { ...player, name } : player,
      ),
    }))
  }

  function startGame() {
    setState((current) => ({
      ...current,
      screen: "score",
      players: current.players.map((player, index) => ({
        ...player,
        name: player.name.trim() || `Joueur ${index + 1}`,
      })),
    }))
  }

  function updateScore(index: number, delta: number) {
    setState((current) => ({
      ...current,
      players: current.players.map((player, playerIndex) =>
        playerIndex === index ? { ...player, current: player.current + delta } : player,
      ),
    }))
  }

  function finishRound() {
    if (!hasCurrentScore) return

    setState((current) => {
      const entries = current.players.map((player) => ({
        name: player.name,
        delta: player.current,
        total: player.total + player.current,
      }))

      return {
        ...current,
        round: current.round + 1,
        history: [
          {
            round: current.round,
            entries,
            createdAt: new Date().toISOString(),
          },
          ...current.history,
        ],
        players: current.players.map((player) => ({
          ...player,
          total: player.total + player.current,
          current: 0,
        })),
      }
    })
  }

  function resetGame() {
    setState((current) => ({
      ...current,
      round: 1,
      history: [],
      players: current.players.map((player) => ({
        ...player,
        total: 0,
        current: 0,
      })),
    }))
  }

  function editGame() {
    setState((current) => ({
      ...current,
      screen: "setup",
    }))
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen()
      return
    }

    if (document.exitFullscreen) {
      await document.exitFullscreen()
    }
  }

  return (
    <main className="h-dvh min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(176_78%_48%/.18),transparent_30rem),radial-gradient(circle_at_bottom_right,hsl(35_100%_52%/.12),transparent_28rem),hsl(240_12%_2%)] p-[max(14px,env(safe-area-inset-top))] text-foreground [@media(orientation:landscape)]:p-[max(6px,env(safe-area-inset-top))]">
      {state.screen === "setup" ? (
        <SetupScreen
          players={state.players}
          count={state.count}
          onCountChange={updatePlayerCount}
          onNameChange={updatePlayerName}
          onSubmit={startGame}
        />
      ) : (
        <ScoreScreen
          state={state}
          hasCurrentScore={hasCurrentScore}
          isHistoryOpen={isHistoryOpen}
          onEdit={editGame}
          onFinishRound={finishRound}
          onHistoryOpenChange={setIsHistoryOpen}
          onReset={resetGame}
          onScoreChange={updateScore}
          onToggleFullscreen={toggleFullscreen}
        />
      )}
    </main>
  )
}

function SetupScreen({
  players,
  count,
  onCountChange,
  onNameChange,
  onSubmit,
}: {
  players: Player[]
  count: number
  onCountChange: (count: number) => void
  onNameChange: (index: number, name: string) => void
  onSubmit: () => void
}) {
  return (
    <section className="mx-auto grid h-full max-w-xl content-center gap-7">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-black uppercase text-cyan-300">Scoring</p>
        <h1 className="text-5xl font-black leading-none tracking-normal">Nouvelle partie</h1>
      </div>

      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-extrabold text-muted-foreground">
            Nombre de joueurs
          </legend>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }, (_, index) => index + 1).map((value) => (
              <Button
                aria-pressed={value === count}
                className="h-14 text-lg font-black aria-pressed:border-cyan-300 aria-pressed:bg-cyan-300/15 aria-pressed:text-cyan-300"
                key={value}
                onClick={() => onCountChange(value)}
                type="button"
                variant="outline"
              >
                {value}
              </Button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3">
          {players.map((player, index) => (
            <label className="flex flex-col gap-1.5" key={index}>
              <span className="text-xs font-extrabold text-muted-foreground">
                Joueur {index + 1}
              </span>
              <input
                className="h-13 rounded-md border border-input bg-input/30 px-3 text-base font-extrabold outline-none transition focus:border-ring focus:ring-[3px] focus:ring-ring/50"
                maxLength={18}
                onChange={(event) => onNameChange(index, event.target.value)}
                value={player.name}
              />
            </label>
          ))}
        </div>

        <Button className="h-16 text-base font-black" type="submit">
          Démarrer
        </Button>
      </form>
    </section>
  )
}

function ScoreScreen({
  state,
  hasCurrentScore,
  isHistoryOpen,
  onEdit,
  onFinishRound,
  onHistoryOpenChange,
  onReset,
  onScoreChange,
  onToggleFullscreen,
}: {
  state: ScoreState
  hasCurrentScore: boolean
  isHistoryOpen: boolean
  onEdit: () => void
  onFinishRound: () => void
  onHistoryOpenChange: (open: boolean) => void
  onReset: () => void
  onScoreChange: (index: number, delta: number) => void
  onToggleFullscreen: () => void
}) {
  return (
    <section className="score-screen-vite grid h-full grid-rows-[auto_auto_1fr] gap-2">
      <header className="score-topbar-vite grid grid-cols-[auto_1fr_auto] items-center gap-2.5">
        <Button
          aria-label="Réinitialiser les scores"
          className="topbar-reset h-13 min-w-13 flex-col gap-0 text-[0.68rem] font-black"
          onClick={onReset}
          type="button"
          variant="outline"
        >
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>

        <h2 className="score-title-vite text-center text-5xl font-black leading-none tracking-normal">
          Scoring
        </h2>

        <div className="flex gap-2">
          <Sheet open={isHistoryOpen} onOpenChange={onHistoryOpenChange}>
            <SheetTrigger asChild>
              <Button
                aria-label="Voir l'historique"
                className="topbar-icon"
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <History data-icon="inline-start" />
              </Button>
            </SheetTrigger>
            <HistorySheet history={state.history} />
          </Sheet>

          <Button
            aria-label="Modifier les joueurs"
            className="topbar-icon"
            onClick={onEdit}
            size="icon-lg"
            type="button"
            variant="outline"
          >
            <Settings data-icon="inline-start" />
          </Button>

          <Button
            aria-label="Passer en plein écran"
            className="topbar-icon"
            onClick={onToggleFullscreen}
            size="icon-lg"
            type="button"
            variant="outline"
          >
            <Expand data-icon="inline-start" />
          </Button>
        </div>
      </header>

      <div className="round-strip-vite grid min-h-11 grid-cols-[auto_1fr] items-center gap-2">
        <Badge
          className="round-count-vite h-11 rounded-md px-3 text-base font-black"
          variant="secondary"
        >
          Manche&nbsp;<span className="text-lg">{state.round}</span>
        </Badge>
        <Button
          className="finish-round-vite h-11 bg-gradient-to-r from-cyan-400 to-blue-500 text-sm font-black text-white hover:from-cyan-400/90 hover:to-blue-500/90"
          disabled={!hasCurrentScore}
          onClick={onFinishRound}
          type="button"
        >
          Fin de manche
        </Button>
      </div>

      <div
        className={cn(
          "score-grid-vite grid min-h-0 gap-2.5",
          state.count === 1 && "grid-cols-1",
          state.count >= 2 && state.count <= 4 && "grid-cols-2",
          state.count >= 5 && "grid-cols-3",
          state.count >= 3 &&
            "landscape-player-count",
        )}
        style={{ "--player-count": state.count } as CSSProperties}
      >
        {state.players.map((player, index) => (
          <PlayerCard
            accent={playerAccents[index]}
            count={state.count}
            key={`${player.name}-${index}`}
            player={player}
            onMinus={() => onScoreChange(index, -1)}
            onPlus={() => onScoreChange(index, 1)}
          />
        ))}
      </div>
    </section>
  )
}

function PlayerCard({
  accent,
  count,
  player,
  onMinus,
  onPlus,
}: {
  accent: string
  count: number
  player: Player
  onMinus: () => void
  onPlus: () => void
}) {
  return (
    <article
      className={cn(
        "player-card-vite grid min-h-0 overflow-hidden rounded-lg border-2 bg-black/70 shadow-2xl",
        "grid-rows-[auto_minmax(0,1fr)_auto_auto_auto]",
      )}
      style={
        {
          "--player-accent": accent,
          borderColor: "var(--player-accent)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--player-accent) 14%, transparent), transparent 35%), rgb(0 0 0 / .72)",
        } as CSSProperties
      }
    >
      <h3
        className={cn(
          "player-name-vite truncate border-b-2 px-2.5 py-3 text-center text-2xl font-black [color:var(--player-accent)]",
          count >= 5 && "py-2 text-sm",
        )}
        style={{ borderColor: "var(--player-accent)" }}
      >
        {player.name}
      </h3>

      <div
        className={cn(
          "score-value-vite grid min-h-0 place-items-center px-2 pb-1 pt-2 text-7xl font-black leading-none text-white drop-shadow-2xl",
          count >= 5 && "text-5xl",
        )}
      >
        {player.total}
      </div>

      <Badge
        className={cn(
          "round-score-vite mx-auto mb-2 rounded-md px-3 py-1 text-sm font-black",
          player.current === 0 && "text-muted-foreground",
          count >= 5 && "mb-1 px-1.5 py-0.5 text-[0.7rem]",
        )}
        style={{
          borderColor: "color-mix(in srgb, var(--player-accent) 50%, transparent)",
          color: player.current === 0 ? undefined : "var(--player-accent)",
        }}
        variant="outline"
      >
        Manche {formatSigned(player.current)}
      </Badge>

      <Button
        className={cn(
          "score-button-vite score-button-plus-vite mx-2.5 mb-2 h-16 rounded-md text-4xl font-black text-white hover:opacity-90",
          count >= 5 && "mx-1.5 mb-1.5 h-11 text-2xl",
        )}
        onClick={onPlus}
        style={{ backgroundColor: "var(--player-accent)" }}
        type="button"
      >
        +1
      </Button>

      <Button
        className={cn(
          "score-button-vite score-button-minus-vite mx-2.5 mb-2 h-16 rounded-md text-4xl font-black text-white hover:opacity-90",
          count >= 5 && "mx-1.5 mb-1.5 h-11 text-2xl",
        )}
        onClick={onMinus}
        style={{ backgroundColor: "color-mix(in srgb, var(--player-accent) 55%, black)" }}
        type="button"
      >
        -1
      </Button>
    </article>
  )
}

function HistorySheet({ history }: { history: HistoryEntry[] }) {
  return (
    <SheetContent className="history-sheet-vite h-[72dvh] border-border/70 bg-background/95 p-0 backdrop-blur" side="bottom">
      <SheetHeader className="border-b">
        <SheetTitle className="text-2xl font-black">Historique</SheetTitle>
        <SheetDescription>Scores validés à chaque fin de manche.</SheetDescription>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
        {history.length === 0 ? (
          <p className="py-8 text-center text-sm font-bold text-muted-foreground">
            Aucune manche validée
          </p>
        ) : (
          <div className="flex flex-col gap-3 py-3">
            {history.map((round) => (
              <Card className="overflow-hidden" key={`${round.round}-${round.createdAt}`}>
                <CardHeader className="border-b px-4 py-3">
                  <CardTitle className="text-base font-black">Manche {round.round}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {round.entries.map((entry) => (
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b px-4 py-2.5 last:border-b-0"
                      key={`${round.round}-${entry.name}`}
                    >
                      <span className="truncate font-extrabold text-muted-foreground">
                        {entry.name}
                      </span>
                      <strong className="font-black">{entry.total}</strong>
                      <span className="font-black text-cyan-300">{formatSigned(entry.delta)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </SheetContent>
  )
}

async function clearLegacyServiceWorker() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }

  if ("caches" in window) {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith("scoring-cache-"))
        .map((key) => caches.delete(key)),
    )
  }
}
