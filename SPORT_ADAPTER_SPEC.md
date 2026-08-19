# Team APP Sport Adapter Contract — v2

## Design rule

A sport adapter describes differences. It must not duplicate shared roster, scheduling, weather, lineup, practice, development or Game Day screens.

## Required top-level concepts

- `adapterVersion: 2`
- stable `key`, name and display metadata
- period terminology and default count
- cumulative or per-period scoring model
- adapter-defined score actions
- one or more units
- default unit
- capabilities
- position/role aliases
- restricted auto-rotation roles
- development skills
- reviewed drills/lessons/rule sets when available

## Unit contract

Every unit defines:
- `key`
- `label`
- roster role definitions
- `layouts`
- `defaultLayoutKey`

Football demonstrates multi-unit support with offense, defense and special teams.

## Layout contract

A layout has a stable key/name and one or more unique slots.

```js
{
  key: '11v11-442',
  label: '11v11 · 4-4-2',
  slots: [
    { key: 'ST1', roleCode: 'ST', label: 'Striker', x: 43, y: 20 },
    { key: 'ST2', roleCode: 'ST', label: 'Striker', x: 57, y: 20 }
  ]
}
```

### Slot invariants
- slot keys are unique within a layout
- `roleCode` must exist in that unit's role registry
- x/y coordinates must be 0–100
- the same athlete may not occupy two active slots in one unit/period

## Roles vs slots

Roster primary/secondary positions use role codes. Layout assignments use slot keys. This allows formations with repeated roles without corrupting roster semantics.

## Default layouts

Each unit has an adapter default. A team may override it via `team.defaultLayouts[unitKey]`. Team defaults affect newly created periods only.

## Formation changes

Shared remapping follows these rules:
1. keep an athlete in the same slot when that slot still exists
2. otherwise preserve role where a compatible new slot exists
3. never assign one athlete twice
4. leave unmatched new slots open for the coach
5. never silently invent eligibility for restricted roles

## Capability gates

Special workflows are enabled by capabilities rather than sport-name checks. Examples:
- ordered batting/sequence
- pitch tracking
- multi-unit planning
- scoring
- substitutions

## Scoring

`cumulative` retains the event score while periods change. `period` stores separate period/set scores. Quick-score values are adapter data.

## Adding a new sport

1. Add roles and units to `sports.js`.
2. Add at least one valid layout for every unit.
3. Choose unit defaults.
4. Define period/scoring/capability metadata.
5. Run `node scripts/generate-sport-schema.js`.
6. Run `./tests/run-all.sh`.
7. Add reviewed coaching content separately; structural registration does not mean learning content is authoritative.
