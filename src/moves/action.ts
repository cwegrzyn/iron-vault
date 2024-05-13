import {
  Move,
  MoveActionRoll,
  MoveProgressRoll,
  TriggerActionRollCondition,
} from "@datasworn/core";
import { Document, Node, format } from "kdljs";
import {
  EditorRange,
  stringifyYaml,
  type App,
  type Editor,
  type FuzzyMatch,
  type MarkdownView,
} from "obsidian";
import { CharacterContext, type CharacterTracker } from "../character-tracker";
import { momentumOps, movesReader, rollablesReader } from "../characters/lens";
import { type Datastore } from "../datastore";
import { ForgedPluginSettings, MoveBlockFormat } from "../settings/ui";
import { ProgressContext } from "../tracks/context";
import { selectProgressTrack } from "../tracks/select";
import { ProgressTrackWriterContext } from "../tracks/writer";
import { randomInt } from "../utils/dice";
import { findAdjacentCodeBlock, reverseLineIterator } from "../utils/editor";
import { vaultProcess } from "../utils/obsidian";
import { CustomSuggestModal } from "../utils/suggest";
import { checkForMomentumBurn } from "./action-modal";
import { AddsModal } from "./adds-modal";
import {
  ActionMoveAdd,
  moveIsAction,
  moveIsProgress,
  type ActionMoveDescription,
  type MoveDescription,
  type ProgressMoveDescription,
} from "./desc";
import { generateMoveLine } from "./move-line-parser";
import { ActionMoveWrapper } from "./wrapper";

enum MoveKind {
  Progress = "Progress",
  Action = "Action",
  Other = "Other",
}

// interface BaseMoveSpecifier {
//   move: Move;
//   kind: MoveKind;
// }

// interface ProgressMoveSpecifier extends BaseMoveSpecifier {
//   kind: MoveKind.Progress;
//   progressTrack: string;
// }

// interface ActionMoveSpecifier extends BaseMoveSpecifier {
//   kind: MoveKind.Action;
//   stat: string;
// }

function getMoveKind(move: Move): MoveKind {
  switch (move.roll_type) {
    case "action_roll":
      return MoveKind.Action;
    case "progress_roll":
      return MoveKind.Progress;
    case "special_track":
    case "no_roll":
      return MoveKind.Other;
    default:
      throw new Error(
        `unexpected roll type ${(move as Move).roll_type} on move id ${
          (move as Move).id
        }`,
      );
  }
}
const promptForMove = async (app: App, moves: Move[]): Promise<Move> =>
  await CustomSuggestModal.select(
    app,
    moves,
    (move) => move.name,
    ({ item: move, match }: FuzzyMatch<Move>, el: HTMLElement) => {
      const moveKind = getMoveKind(move);
      el.createEl("small", {
        text: `(${moveKind}) ${move.trigger.text}`,
        cls: "forged-suggest-hint",
      });
    },
  );

function processActionMove(
  move: Move,
  stat: string,
  statVal: number,
  adds: ActionMoveAdd[],
): ActionMoveDescription {
  return {
    name: move.name,
    action: randomInt(1, 6),
    stat,
    statVal,
    adds,
    challenge1: randomInt(1, 10),
    challenge2: randomInt(1, 10),
  };
}

function processProgressMove(
  move: Move,
  tracker: ProgressTrackWriterContext,
): ProgressMoveDescription {
  return {
    name: move.name,
    progressTrack: `[[${tracker.location}]]`,
    progressTicks: tracker.track.progress,
    challenge1: randomInt(1, 10),
    challenge2: randomInt(1, 10),
  };
}

function yamlMoveRenderer(editor: Editor): (move: MoveDescription) => void {
  return (move) => {
    editor.replaceSelection(`\`\`\`move\n${stringifyYaml(move)}\n\`\`\`\n\n`);
  };
}

function moveLineMoveRenderer(editor: Editor): (move: MoveDescription) => void {
  return (move) => {
    editor.replaceSelection(
      `\`\`\`move\n${generateMoveLine(move)}\n\`\`\`\n\n`,
    );
  };
}

export function validAdds(baseStat: number): number[] {
  const adds = [];
  for (let add = 0; 1 + baseStat + add <= 10; add++) {
    adds.push(add);
  }
  return adds;
}

function node(name: string, data: Omit<Partial<Node>, "name">): Node {
  return {
    name,
    properties: {},
    values: [],
    children: [],
    ...data,
    // TODO: the `as any` is a hack because the name field is not optional currently but should be
    tags: { properties: {}, values: [], ...data.tags } as any,
  };
}

function generateMechanicsNode(move: MoveDescription): string {
  let roll: Node;
  let addDesc: Node[] = [];
  if (moveIsAction(move)) {
    const adds = (move.adds ?? []).reduce((acc, { amount }) => acc + amount, 0);
    roll = node("roll", {
      values: [move.stat],
      properties: {
        action: move.action,
        stat: move.statVal,
        adds,
        vs1: move.challenge1,
        vs2: move.challenge2,
      },
    });
    addDesc = (move.adds ?? [])
      .filter(({ amount }) => amount != 0)
      .map(({ amount, desc }) =>
        node("add", { values: [amount, ...(desc ? [desc] : [])] }),
      );
  } else if (moveIsProgress(move)) {
    roll = node("progress-roll", {
      properties: {
        // TODO: what about progress track id?
        // TODO: use a ticks prop instead... or at least use a helper to get this
        score: Math.floor(move.progressTicks / 4),
        vs1: move.challenge1,
        vs2: move.challenge2,
      },
    });
  } else {
    throw new Error("what kind of move is this?");
  }

  // TODO: move name vs move id
  const doc: Document = [
    node("move", {
      values: [move.name],
      children: [...addDesc, roll],
    }),
  ];
  return format(doc);
}

const MECHANICS_CODE_BLOCK_TAG = "mechanics";

function mechanicsMoveRenderer(
  editor: Editor,
): (move: MoveDescription) => void {
  return (move) => {
    // TODO: right now, if something is selected, we just replace it, and skip the block merging logic. Should we do something else?
    let existingBlockRange: EditorRange | null = null;
    if (!editor.somethingSelected()) {
      existingBlockRange = findAdjacentCodeBlock(
        reverseLineIterator(editor, editor.getCursor()),
        MECHANICS_CODE_BLOCK_TAG,
      );
    }

    if (existingBlockRange) {
      // Insert additional node at the end of the existing block
      editor.replaceRange(`${generateMechanicsNode(move)}\n`, {
        line: existingBlockRange.to.line - 1,
        ch: 0,
      });
    } else {
      const extraLine = editor.getCursor("from").ch > 0 ? "\n\n" : "";
      editor.replaceSelection(
        `${extraLine}\`\`\`${MECHANICS_CODE_BLOCK_TAG}\n${generateMechanicsNode(move)}\`\`\`\n\n`,
      );
    }
  };
}

export function getMoveRenderer(
  format: MoveBlockFormat,
  editor: Editor,
): (move: MoveDescription) => void {
  switch (format) {
    case MoveBlockFormat.MoveLine:
      return moveLineMoveRenderer(editor);
    case MoveBlockFormat.YAML:
      return yamlMoveRenderer(editor);
    case MoveBlockFormat.Mechanics:
      return mechanicsMoveRenderer(editor);
  }
}

export async function runMoveCommand(
  app: App,
  datastore: Datastore,
  progressContext: ProgressContext,
  characters: CharacterTracker,
  editor: Editor,
  view: MarkdownView,
  settings: ForgedPluginSettings,
): Promise<void> {
  if (view.file?.path == null) {
    console.error("No file for view. Why?");
    return;
  }

  const [characterPath, context] = characters.activeCharacter();

  const { character, lens } = context;

  const characterMoves = movesReader(lens, datastore.index)
    .get(character)
    .expect("unexpected failure finding assets for moves");

  const allMoves = datastore.moves
    .concat(characterMoves)
    .filter(
      (move) =>
        move.roll_type == "action_roll" || move.roll_type == "progress_roll",
    );

  const moveRenderer: (move: MoveDescription) => void = getMoveRenderer(
    settings.moveBlockFormat,
    editor,
  );

  const move = await promptForMove(
    app,
    allMoves.sort((a, b) => a.name.localeCompare(b.name)),
  );

  let moveDescription: MoveDescription;
  switch (move.roll_type) {
    case "action_roll": {
      moveDescription = await handleActionRoll(
        context,
        app,
        move,
        characterPath,
        editor,
      );
      break;
    }
    case "progress_roll": {
      moveDescription = await handleProgressRoll(
        app,
        progressContext,
        move,
        editor,
      );
      break;
    }
    case "no_roll":
    case "special_track":
    default:
      // TODO: this probably makes sense with new mechanics format?
      console.warn(
        "Teach me how to handle a move with roll type %s: %o",
        move.roll_type,
        move,
      );
      return;
  }

  moveRenderer(moveDescription);
}

async function handleProgressRoll(
  app: App,
  progressContext: ProgressContext,
  move: MoveProgressRoll,
  editor: Editor,
): Promise<MoveDescription> {
  const progressTrack = await selectProgressTrack(
    progressContext,
    app,
    (prog) => prog.trackType == move.tracks.category && !prog.track.complete,
  );
  // TODO: when would we mark complete? should we prompt on a hit?
  return processProgressMove(move, progressTrack);
}

const ORDINALS = [
  "zeroth",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
];

// TODO: refactor this so it returns the description and handle the other parts separately?
async function handleActionRoll(
  charContext: CharacterContext,
  app: App,
  move: MoveActionRoll,
  characterPath: string,
  editor: Editor,
) {
  const { lens, character } = charContext;

  const suggestedRollables: Record<
    string,
    Array<Omit<TriggerActionRollCondition, "roll_options">>
  > = {};

  for (const condition of move.trigger.conditions) {
    const { roll_options, ...conditionSpec } = condition;
    for (const rollable of roll_options) {
      let rollableToAdd;
      switch (rollable.using) {
        case "stat":
          rollableToAdd = rollable.stat;
          break;
        case "condition_meter":
          rollableToAdd = rollable.condition_meter;
          break;
        default:
          console.warn(
            "unhandled rollable scenario %o %o",
            condition,
            rollable,
          );
      }
      if (!rollableToAdd) continue;
      if (!(rollableToAdd in suggestedRollables)) {
        suggestedRollables[rollableToAdd] = [];
      }
      suggestedRollables[rollableToAdd].push(conditionSpec);
    }
  }

  const stat = await CustomSuggestModal.select(
    app,
    rollablesReader(lens)
      .get(character)
      .map((meter) => {
        return { ...meter, condition: suggestedRollables[meter.key] ?? [] };
      })
      .sort((a, b) => {
        if (a.condition.length > 0 && b.condition.length == 0) {
          return -1;
        } else if (a.condition.length == 0 && b.condition.length > 0) {
          return 1;
        } else {
          return (
            b.value - a.value ||
            a.definition.label.localeCompare(b.definition.label)
          );
        }
      }),
    (m) => `${m.definition.label}: ${m.value ?? "missing (defaults to 0)"}`,
    ({ item, match }, el) => {
      if (item.condition.length > 0) {
        el.createEl("small", {
          text: `Trigger: ${item.condition.flatMap((cond) => cond.text ?? []).join("; ")}`,
          cls: "forged-suggest-hint",
        });
      }
    },
    move.trigger.text,
  );

  const adds = [];
  // TODO: do we need this arbitrary cutoff on adds? just wanted to avoid a kinda infinite loop
  while (adds.length < 5) {
    const addValue = await CustomSuggestModal.select(
      app,
      validAdds(stat.value ?? 0),
      (n) => n.toString(10),
      undefined,
      `Choose an amount for the ${ORDINALS[adds.length + 1]} add.`,
    );
    if (addValue == 0) break;
    const addReason = await AddsModal.show(app, `+${addValue}`);
    const add: { amount: number; desc?: string } = { amount: addValue };
    if ((addReason ?? "").length > 0) {
      add.desc = addReason;
    }
    adds.push(add);
  }

  let description = processActionMove(move, stat.key, stat.value ?? 0, adds);
  const wrapper = new ActionMoveWrapper(description);
  description = await checkForMomentumBurn(
    app,
    move as MoveActionRoll,
    wrapper,
    charContext,
  );
  // TODO: maybe this should be pulled up into the other function (even though it only
  // applies for action moves.
  if (description.burn) {
    await charContext.updater(
      vaultProcess(app, characterPath),
      (character, { lens }) => momentumOps(lens).reset(character),
    );
  }
  return description;
}
