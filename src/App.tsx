import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { Download, Expand, List, RotateCcw, Settings } from "lucide-react"

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
type ScoreGoal = "highest" | "lowest"

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
  useRounds: boolean
  scoreGoal: ScoreGoal
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
    useRounds: true,
    scoreGoal: "highest",
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
      useRounds: stored.useRounds !== false,
      scoreGoal: stored.scoreGoal === "lowest" ? "lowest" : "highest",
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

function sortPlayersByGoal(players: Player[], scoreGoal: ScoreGoal) {
  return [...players].sort((first, second) =>
    scoreGoal === "lowest" ? first.total - second.total : second.total - first.total,
  )
}

function getScoreGoalLabel(scoreGoal: ScoreGoal) {
  return scoreGoal === "lowest" ? "Moins de points" : "Plus de points"
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

  function updateUseRounds(useRounds: boolean) {
    setState((current) => ({
      ...current,
      useRounds,
      players: current.players.map((player) => ({
        ...player,
        total: useRounds ? player.total : player.total + player.current,
        current: useRounds ? player.current : 0,
      })),
    }))
  }

  function updateScoreGoal(scoreGoal: ScoreGoal) {
    setState((current) => ({
      ...current,
      scoreGoal,
    }))
  }

  function startGame() {
    setState((current) => ({
      ...current,
      screen: "score",
      players: current.players.map((player, index) => ({
        ...player,
        name: player.name.trim() || `Joueur ${index + 1}`,
        current: current.useRounds ? player.current : 0,
      })),
    }))
  }

  function updateScore(index: number, delta: number) {
    setState((current) => ({
      ...current,
      players: current.players.map((player, playerIndex) =>
        playerIndex === index
          ? current.useRounds
            ? { ...player, current: player.current + delta }
            : { ...player, total: player.total + delta }
          : player,
      ),
    }))
  }

  function finishRound() {
    if (!state.useRounds || !hasCurrentScore) return

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
    <main className="app-shell-vite h-dvh min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(176_78%_48%/.18),transparent_30rem),radial-gradient(circle_at_bottom_right,hsl(35_100%_52%/.12),transparent_28rem),hsl(240_12%_2%)] p-[max(14px,env(safe-area-inset-top))] text-foreground [@media(orientation:landscape)]:p-[max(6px,env(safe-area-inset-top))]">
      {state.screen === "setup" ? (
        <SetupScreen
          players={state.players}
          count={state.count}
          useRounds={state.useRounds}
          scoreGoal={state.scoreGoal}
          onCountChange={updatePlayerCount}
          onNameChange={updatePlayerName}
          onScoreGoalChange={updateScoreGoal}
          onUseRoundsChange={updateUseRounds}
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
  useRounds,
  scoreGoal,
  onCountChange,
  onNameChange,
  onScoreGoalChange,
  onUseRoundsChange,
  onSubmit,
}: {
  players: Player[]
  count: number
  useRounds: boolean
  scoreGoal: ScoreGoal
  onCountChange: (count: number) => void
  onNameChange: (index: number, name: string) => void
  onScoreGoalChange: (scoreGoal: ScoreGoal) => void
  onUseRoundsChange: (useRounds: boolean) => void
  onSubmit: () => void
}) {
  return (
    <section className="setup-screen-vite mx-auto flex h-full max-w-xl flex-col gap-7 overflow-hidden">
      <div className="setup-head-vite flex flex-col gap-2">
        <p className="setup-label-vite text-sm font-black uppercase text-cyan-300">Scoring</p>
        <h1 className="setup-title-vite text-5xl font-black leading-none tracking-normal">
          Nouvelle partie
        </h1>
      </div>

      <form
        className="setup-form-vite flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="setup-legend-vite text-sm font-extrabold text-muted-foreground">
            Nombre de joueurs
          </legend>
          <div className="setup-count-grid-vite grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }, (_, index) => index + 1).map((value) => (
              <Button
                aria-pressed={value === count}
                className="setup-count-button-vite h-14 text-lg font-black aria-pressed:border-cyan-300 aria-pressed:bg-cyan-300/15 aria-pressed:text-cyan-300"
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

        <fieldset className="flex flex-col gap-3">
          <legend className="setup-legend-vite text-sm font-extrabold text-muted-foreground">
            Type de partie
          </legend>
          <div className="setup-mode-grid-vite grid grid-cols-2 gap-2">
            <Button
              aria-pressed={useRounds}
              className="setup-mode-button-vite h-14 text-sm font-black aria-pressed:border-cyan-300 aria-pressed:bg-cyan-300/15 aria-pressed:text-cyan-300"
              onClick={() => onUseRoundsChange(true)}
              type="button"
              variant="outline"
            >
              Avec manches
            </Button>
            <Button
              aria-pressed={!useRounds}
              className="setup-mode-button-vite h-14 text-sm font-black aria-pressed:border-cyan-300 aria-pressed:bg-cyan-300/15 aria-pressed:text-cyan-300"
              onClick={() => onUseRoundsChange(false)}
              type="button"
              variant="outline"
            >
              Sans manches
            </Button>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="setup-legend-vite text-sm font-extrabold text-muted-foreground">
            Objectif du score
          </legend>
          <div className="setup-goal-grid-vite grid grid-cols-2 gap-2">
            <Button
              aria-pressed={scoreGoal === "highest"}
              className="setup-goal-button-vite h-14 text-sm font-black aria-pressed:border-cyan-300 aria-pressed:bg-cyan-300/15 aria-pressed:text-cyan-300"
              onClick={() => onScoreGoalChange("highest")}
              type="button"
              variant="outline"
            >
              Plus haut gagne
            </Button>
            <Button
              aria-pressed={scoreGoal === "lowest"}
              className="setup-goal-button-vite h-14 text-sm font-black aria-pressed:border-cyan-300 aria-pressed:bg-cyan-300/15 aria-pressed:text-cyan-300"
              onClick={() => onScoreGoalChange("lowest")}
              type="button"
              variant="outline"
            >
              Plus bas gagne
            </Button>
          </div>
        </fieldset>

        <div className="setup-name-fields-vite grid gap-3">
          {players.map((player, index) => (
            <label className="setup-name-field-vite flex flex-col" key={index}>
              <span className="setup-name-label-vite text-xs font-extrabold text-muted-foreground">
                Joueur {index + 1}
              </span>
              <input
                className="setup-input-vite rounded-md border border-input bg-input/30 px-3 text-base font-extrabold outline-none transition focus:border-ring focus:ring-[3px] focus:ring-ring/50"
                maxLength={18}
                onChange={(event) => onNameChange(index, event.target.value)}
                value={player.name}
              />
            </label>
          ))}
        </div>

        <Button className="setup-submit-vite text-base font-black" type="submit">
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
    <section
      className="score-screen-vite grid h-full grid-rows-[auto_auto_1fr] gap-2"
    >
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

        <div className="topbar-actions-vite flex gap-2">
          <Sheet open={isHistoryOpen} onOpenChange={onHistoryOpenChange}>
            <SheetTrigger asChild>
              <Button
                aria-label="Voir le résumé"
                className="topbar-icon"
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <List data-icon="inline-start" />
              </Button>
            </SheetTrigger>
            <HistorySheet
              history={state.history}
              players={state.players}
              round={state.round}
              scoreGoal={state.scoreGoal}
              useRounds={state.useRounds}
            />
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

      {state.useRounds && (
        <div className="round-strip-vite grid min-h-11 grid-cols-[auto_auto_1fr] items-center gap-2">
          <Badge
            className="round-count-vite h-11 rounded-md px-3 text-base font-black"
            variant="secondary"
          >
            Manche&nbsp;<span className="text-lg">{state.round}</span>
          </Badge>
          <Badge className="goal-count-vite h-11 rounded-md px-3 text-sm font-black" variant="outline">
            {getScoreGoalLabel(state.scoreGoal)}
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
      )}

      {!state.useRounds && (
        <div className="goal-strip-vite grid min-h-9 items-center">
          <Badge className="goal-count-vite h-9 rounded-md px-3 text-sm font-black" variant="secondary">
            Objectif&nbsp;: {getScoreGoalLabel(state.scoreGoal)}
          </Badge>
        </div>
      )}

      <div
        className={cn(
          "score-grid-vite grid min-h-0 gap-2.5",
          `players-${state.count}`,
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
            useRounds={state.useRounds}
            onScoreChange={(delta) => onScoreChange(index, delta)}
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
  useRounds,
  onScoreChange,
}: {
  accent: string
  count: number
  player: Player
  useRounds: boolean
  onScoreChange: (delta: number) => void
}) {
  return (
    <article
      className={cn(
        "player-card-vite grid min-h-0 min-w-0 overflow-hidden rounded-lg border-2 bg-black/70 shadow-2xl",
        "grid-rows-[auto_minmax(0,1fr)]",
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

      <div className="score-stack-vite">
        <div className="score-control-row-vite">
          <Button
            aria-label={`Ajouter 10 points a ${player.name}`}
            className={cn(
              "score-button-vite score-button-step-vite rounded-md font-black text-white hover:opacity-90",
              count >= 5 && "text-base",
            )}
            onClick={() => onScoreChange(10)}
            style={{ backgroundColor: "var(--player-accent)" }}
            type="button"
          >
            +10
          </Button>
          <Button
            aria-label={`Ajouter 5 points a ${player.name}`}
            className={cn(
              "score-button-vite score-button-step-vite rounded-md font-black text-white hover:opacity-90",
              count >= 5 && "text-base",
            )}
            onClick={() => onScoreChange(5)}
            style={{ backgroundColor: "var(--player-accent)" }}
            type="button"
          >
            +5
          </Button>
          <Button
            aria-label={`Ajouter 1 point a ${player.name}`}
            className={cn(
              "score-button-vite score-button-unit-vite score-button-plus-vite rounded-md font-black text-white hover:opacity-90",
              count >= 5 && "text-2xl",
            )}
            onClick={() => onScoreChange(1)}
            style={{ backgroundColor: "var(--player-accent)" }}
            type="button"
          >
            +
          </Button>
        </div>

        <div
          className={cn(
            "score-value-vite grid min-h-0 place-items-center px-2 text-7xl font-black leading-none text-white drop-shadow-2xl",
            count >= 5 && "text-5xl",
          )}
        >
          {player.total}
        </div>

        {useRounds && (
          <Badge
            className={cn(
              "round-score-vite mx-auto rounded-md px-3 py-1 text-sm font-black",
              player.current === 0 && "text-muted-foreground",
              count >= 5 && "px-1.5 py-0.5 text-[0.7rem]",
            )}
            style={{
              borderColor: "color-mix(in srgb, var(--player-accent) 50%, transparent)",
              color: player.current === 0 ? undefined : "var(--player-accent)",
            }}
            variant="outline"
          >
            Manche {formatSigned(player.current)}
          </Badge>
        )}

        <div className="score-control-row-vite">
          <Button
            aria-label={`Retirer 10 points a ${player.name}`}
            className={cn(
              "score-button-vite score-button-step-vite score-button-minus-vite rounded-md font-black text-white hover:opacity-90",
              count >= 5 && "text-base",
            )}
            onClick={() => onScoreChange(-10)}
            style={{ backgroundColor: "color-mix(in srgb, var(--player-accent) 55%, black)" }}
            type="button"
          >
            -10
          </Button>
          <Button
            aria-label={`Retirer 5 points a ${player.name}`}
            className={cn(
              "score-button-vite score-button-step-vite score-button-minus-vite rounded-md font-black text-white hover:opacity-90",
              count >= 5 && "text-base",
            )}
            onClick={() => onScoreChange(-5)}
            style={{ backgroundColor: "color-mix(in srgb, var(--player-accent) 55%, black)" }}
            type="button"
          >
            -5
          </Button>
          <Button
            aria-label={`Retirer 1 point a ${player.name}`}
            className={cn(
              "score-button-vite score-button-unit-vite score-button-minus-vite rounded-md font-black text-white hover:opacity-90",
              count >= 5 && "text-2xl",
            )}
            onClick={() => onScoreChange(-1)}
            style={{ backgroundColor: "color-mix(in srgb, var(--player-accent) 55%, black)" }}
            type="button"
          >
            -
          </Button>
        </div>
      </div>
    </article>
  )
}

function HistorySheet({
  history,
  players,
  round,
  scoreGoal,
  useRounds,
}: {
  history: HistoryEntry[]
  players: Player[]
  round: number
  scoreGoal: ScoreGoal
  useRounds: boolean
}) {
  const ranking = sortPlayersByGoal(players, scoreGoal)
  return (
    <SheetContent className="history-sheet-vite h-[72dvh] border-border/70 bg-background/95 p-0 backdrop-blur" side="bottom">
      <SheetHeader className="border-b">
        <SheetTitle className="text-2xl font-black">Résumé</SheetTitle>
        <SheetDescription>
          {useRounds
            ? "Classement actuel et scores valides a chaque fin de manche."
            : "Classement actuel en score direct."}
        </SheetDescription>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
        <Card className="mt-3 overflow-hidden">
          <CardHeader className="border-b px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-black">Classement</CardTitle>
              <Button
                className="h-8 px-3 text-xs font-black"
                onClick={() => downloadSummary(players, history, round, useRounds, scoreGoal)}
                type="button"
                variant="outline"
              >
                <Download data-icon="inline-start" />
                Télécharger
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {ranking.map((player, index) => (
              <div
                className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-b px-4 py-2.5 last:border-b-0"
                key={`${player.name}-${index}`}
              >
                <Badge className="rounded-md font-black" variant={index === 0 ? "default" : "secondary"}>
                  {index + 1}
                </Badge>
                <span className="truncate font-extrabold text-muted-foreground">{player.name}</span>
                {player.current !== 0 && (
                  <span className="text-xs font-black text-cyan-300">
                    {formatSigned(player.current)}
                  </span>
                )}
                <strong className="font-black">{player.total}</strong>
              </div>
            ))}
          </CardContent>
        </Card>

        {!useRounds ? null : history.length === 0 ? (
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

function downloadSummary(
  players: Player[],
  history: HistoryEntry[],
  round: number,
  useRounds: boolean,
  scoreGoal: ScoreGoal,
) {
  const content = buildSummaryText(players, history, round, useRounds, scoreGoal)
  const blob = new Blob(["\ufeff", content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = `scoring-resume-manche-${round}.txt`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildSummaryText(
  players: Player[],
  history: HistoryEntry[],
  round: number,
  useRounds: boolean,
  scoreGoal: ScoreGoal,
) {
  const ranking = sortPlayersByGoal(players, scoreGoal)
  const lines = [
    "Résumé Scoring",
    useRounds ? `Manche en cours : ${round}` : "Mode : sans manches",
    `Objectif : ${getScoreGoalLabel(scoreGoal)}`,
    "",
    "Classement",
    ...ranking.map((player, index) => {
      const current = player.current !== 0 ? ` (${formatSigned(player.current)} en cours)` : ""
      return `${index + 1}. ${player.name} - ${player.total}${current}`
    }),
    "",
    "Historique",
  ]

  if (!useRounds) {
    lines.push("Partie en score direct")
  } else if (history.length === 0) {
    lines.push("Aucune manche validée")
  } else {
    history.forEach((entry) => {
      lines.push("", `Manche ${entry.round}`)
      entry.entries.forEach((score) => {
        lines.push(`- ${score.name}: ${score.total} (${formatSigned(score.delta)})`)
      })
    })
  }

  return `${lines.join("\n")}\n`
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
