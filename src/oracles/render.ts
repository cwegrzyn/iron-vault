import { type Datastore } from "datastore";
import {
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  parseYaml,
  type App,
  type MarkdownPostProcessorContext,
  type Plugin,
} from "obsidian";
import { formatOracleBlock } from "./command";
import { OracleRoller } from "./roller";
import { oracleSchema, type OracleSchema, type RollSchema } from "./schema";

export function registerOracleBlock(
  plugin: Plugin,
  datastore: Datastore,
): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "oracle",
    async (source, el, ctx) => {
      const doc = parseYaml(source);
      const validatedOracle = oracleSchema.safeParse(doc);

      if (validatedOracle.success) {
        ctx.addChild(
          new OracleMarkdownRenderChild(
            el,
            plugin.app,
            ctx,
            datastore,
            validatedOracle.data,
          ),
        );
      } else {
        el.createEl("pre", {
          text:
            "Error parsing oracle result\n" +
            JSON.stringify(validatedOracle.error.format()),
        });
      }
    },
  );
}

// function renderRoll(roll: Roll): string {
//   switch (roll.kind) {
//     case "multi":
//       return `(${roll.roll} on ${roll.table.Title.Standard} -> ${
//         roll.row.Result
//       }): ${roll.results.map((r) => renderRoll(r)).join(", ")}`;
//     case "simple":
//       return `(${roll.roll} on ${roll.table.Title.Standard}) ${roll.row.Result}`;
//     case "templated":
//       return `(${roll.roll} on ${roll.table.Title.Standard}) ${roll.row[
//         "Roll template"
//       ]?.Result?.replace(/\{\{([^{}]+)\}\}/g, (_match, id) => {
//         // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
//         return renderRoll(roll.templateRolls.get(id)!);
//       })}`;
//     default: {
//       const _exhaustiveCheck: never = roll;
//       return _exhaustiveCheck;
//     }
//   }
// }

function renderDetails(roll: RollSchema): string {
  let result = `${roll.tableName} (${roll.roll}: ${
    roll.raw ?? roll.results[0]
  })`;
  switch (roll.kind) {
    case "multi":
      result += ` -> (${roll.rolls.map(renderDetails).join(", ")})`;
      break;
    case "templated":
      result += ` -> (${Object.values(roll.templateRolls)
        .map(renderDetails)
        .join(", ")})`;
      break;
  }
  return result;
}

export function renderRollPath(roll: RollSchema): string {
  let result = `${roll.tableId}:${roll.roll}`;
  switch (roll.kind) {
    case "multi":
      result += `(${roll.rolls.map(renderRollPath).join(",")})`;
      break;
    case "templated":
      result += `(${Object.values(roll.templateRolls)
        .map(renderRollPath)
        .join(",")})`;
      break;
  }
  return result;
}

export function renderOracleCallout(oracle: OracleSchema): string {
  const { roll, question } = oracle;
  return `> [!oracle] ${question ?? "Ask the Oracle"}: ${roll.results.join(
    "; ",
  )} %%${renderRollPath(roll)}%%\n>\n\n`;
}

export function renderDetailedOracleCallout(oracle: OracleSchema): string {
  const { roll, question } = oracle;
  return `> [!oracle] ${question ?? "Ask the Oracle"}: ${roll.results.join(
    "; ",
  )}\n> ${renderDetails(roll)}\n\n`;
}

class OracleMarkdownRenderChild extends MarkdownRenderChild {
  protected _renderEl: HTMLElement;

  constructor(
    containerEl: HTMLElement,
    protected readonly app: App,
    protected readonly ctx: MarkdownPostProcessorContext,
    protected readonly datastore: Datastore,
    protected readonly oracle: OracleSchema,
  ) {
    super(containerEl);
  }

  template(): string {
    return renderDetailedOracleCallout(this.oracle);
  }

  async render(): Promise<void> {
    this._renderEl.replaceChildren();
    await MarkdownRenderer.render(
      this.app,
      this.template(),
      this._renderEl,
      this.ctx.sourcePath,
      this,
    );
  }

  async onload(): Promise<void> {
    const div = this.containerEl.createDiv();
    const button = div.createEl("button", { type: "button", text: "Re-roll" });
    // TODO: only render actions if we are in edit-only mode
    button.onClickEvent((_ev) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (this.ctx.sourcePath !== view?.file?.path) {
        throw new Error(
          `ctx path ${this.ctx.sourcePath} that doesn't match view path ${view?.file?.path}`,
        );
      }

      const sectionInfo = this.ctx.getSectionInfo(this.containerEl);
      if (view?.editor != null && sectionInfo != null) {
        const editor = view.editor;

        const oracles = this.datastore.oracles;
        const result = new OracleRoller(oracles).roll(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          oracles.getTable(this.oracle.roll.tableId)!,
        );

        editor.replaceRange(
          "\n\n" + formatOracleBlock({ roll: result }),
          { line: sectionInfo.lineEnd + 1, ch: 0 },
          { line: sectionInfo.lineEnd + 1, ch: 0 },
        );
      }
    });
    this._renderEl = this.containerEl.createDiv();

    if (this.datastore.ready) {
      await this.render();
    }
    this.registerEvent(
      this.app.metadataCache.on("forged:index-changed", async () => {
        await this.render();
      }),
    );
  }
}