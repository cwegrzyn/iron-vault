import * as kdl from "kdljs";
import { Editor, EditorRange } from "obsidian";
import {
  findAdjacentCodeBlock,
  interiorRange,
  reverseLineIterator,
  updateCodeBlockInterior,
} from "../utils/editor";

export const MECHANICS_CODE_BLOCK_TAG = "iron-vault-mechanics";

/** Appends nodes to an existing mechanics block or inserts a new block. */
export function createOrUpdateBlock(
  editor: Editor,
  blockTag: string,
  updating: (existing?: string) => string,
): void {
  // TODO: right now, if something is selected, we just replace it, and skip the block merging logic. Should we do something else?
  let existingBlockRange: EditorRange | null = null;
  if (!editor.somethingSelected()) {
    existingBlockRange = findAdjacentCodeBlock(
      reverseLineIterator(editor, editor.getCursor()),
      blockTag,
    );
  }

  if (existingBlockRange) {
    // Insert additional nodes at the end of the existing block
    updateCodeBlockInterior(editor, existingBlockRange, updating);
  } else {
    const extraLine = editor.getCursor("from").ch > 0 ? "\n\n" : "";
    editor.replaceSelection(
      `${extraLine}\`\`\`${blockTag}\n${updating()}\`\`\`\n\n`,
    );
  }
}

/** Returns the KDL contents of a prior adjacent mechanics block if one exists. */
export function findAdjacentMechanicsBlock(
  editor: Editor,
): kdl.Document | undefined {
  const lastBlockRange = findAdjacentCodeBlock(
    reverseLineIterator(editor, editor.getCursor()),
    MECHANICS_CODE_BLOCK_TAG,
  );
  if (!lastBlockRange) return undefined;

  const range = interiorRange(lastBlockRange);
  const block = editor.getRange(range.from, range.to);
  const parsed = kdl.parse(block);
  if (parsed.errors.length > 0) {
    return undefined;
  }
  return parsed.output;
}

function parseMechanicsBlock(block: string): kdl.Document {
  const parsed = kdl.parse(block);
  if (parsed.errors.length > 0 || !parsed.output) {
    // TODO: maybe if this happens, it's a sign that we should just insert the block as a new block?
    throw new Error(`Error while parsing mechanics block: ${block}`, {
      cause: parsed.errors,
    });
  }
  return parsed.output;
}

/** Appends nodes to an existing mechanics block or inserts a new block. */
export function createOrAppendMechanics(
  editor: Editor,
  newItems: kdl.Node[],
): void {
  createOrUpdateBlock(editor, MECHANICS_CODE_BLOCK_TAG, (existing) => {
    if (existing) {
      // Parse throws an error if the block is invalid
      parseMechanicsBlock(existing);
    }
    return (existing ? existing + "\n" : "") + kdl.format(newItems);
  });
}

/** Allows adding to previous move or creating a new mechanics block. */
export function updatePreviousMoveOrCreateBlock(
  editor: Editor,
  update: (moveNode: kdl.Node) => kdl.Node,
  createTopLevel: () => kdl.Node,
) {
  createOrUpdateBlock(editor, MECHANICS_CODE_BLOCK_TAG, (existing) => {
    if (existing) {
      const output = parseMechanicsBlock(existing);

      // If the last node is a move, update it. Otherwise, create a new top-level node.
      const lastIndex = output.length - 1;
      if (lastIndex >= 0 && output[lastIndex].name == "move") {
        output[lastIndex] = update(output[lastIndex]);
      } else {
        output.push(createTopLevel());
      }
      return kdl.format(output);
    } else {
      return kdl.format([createTopLevel()]);
    }
  });
}

/** Adds nodes to the end of a preceding move or block, or creates a new block. */
export function appendNodesToMoveOrMechanicsBlock(
  editor: Editor,
  ...nodes: kdl.Node[]
) {
  createOrUpdateBlock(editor, MECHANICS_CODE_BLOCK_TAG, (existing) => {
    if (existing) {
      const output = parseMechanicsBlock(existing);

      // If the last node is a move, update it. Otherwise, create a new top-level node.
      const lastIndex = output.length - 1;
      if (lastIndex >= 0 && output[lastIndex].name == "move") {
        output[lastIndex].children.push(...nodes);
      } else {
        output.push(...nodes);
      }
      return kdl.format(output);
    } else {
      return kdl.format(nodes);
    }
  });
}
