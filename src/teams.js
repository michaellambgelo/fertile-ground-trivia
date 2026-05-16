// Game-scope team state for barstool mode. Lives in React state only — no
// localStorage. The score only has to last as long as the current game;
// refreshing the display window resets it by design. Control window holds
// the source of truth and broadcasts `teams:update` to the display.

export const DEFAULT_TEAM_STATE = {
  a: { name: 'Team 1', score: 0 },
  b: { name: 'Team 2', score: 0 },
};

// Build a fresh team state from `meta.teams` names. Scores start at 0.
export function makeTeams(meta) {
  return {
    a: { name: meta?.teams?.a || DEFAULT_TEAM_STATE.a.name, score: 0 },
    b: { name: meta?.teams?.b || DEFAULT_TEAM_STATE.b.name, score: 0 },
  };
}
