import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";

import IronVaultPlugin from "index";
import { EventRef, TFile } from "obsidian";
import { CharacterContext } from "../character-tracker";
import renderAssetCard from "./asset-card";
import { md } from "utils/ui/directives";

export default function registerCharacterBlock(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-character",
    async (source: string, el: CharacterContainerEl, ctx) => {
      // We can't render blocks until datastore is ready.
      await plugin.datastore.waitForReady;
      if (!el.characterRenderer) {
        el.characterRenderer = new CharacterRenderer(el, source, plugin);
      }
      const file = plugin.app.vault.getFileByPath(ctx.sourcePath);
      await el.characterRenderer.render(file);
    },
  );
}

interface CharacterContainerEl extends HTMLElement {
  characterRenderer?: CharacterRenderer;
}

class CharacterRenderer {
  contentEl: HTMLElement;
  source: string;
  plugin: IronVaultPlugin;
  fileWatcher?: EventRef;

  constructor(contentEl: HTMLElement, source: string, plugin: IronVaultPlugin) {
    this.contentEl = contentEl;
    this.source = source;
    this.plugin = plugin;
  }

  async render(file: TFile | undefined | null) {
    if (!file) {
      render(
        html`<pre>Error rendering character: no file found.</pre>`,
        this.contentEl,
      );
      return;
    }
    const character = this.plugin.characters.get(file.path);
    if (this.fileWatcher) {
      this.plugin.app.metadataCache.offref(this.fileWatcher);
    }
    this.fileWatcher = this.plugin.app.metadataCache.on(
      "changed",
      (moddedFile) => {
        if (moddedFile.path === file.path) {
          this.render(moddedFile);
        }
      },
    );
    this.plugin.registerEvent(this.fileWatcher);
    if (!character || character.isLeft()) {
      render(
        // TODO: we should preserve the error?
        //html`<pre>Error rendering clock: ${res.error.message}</pre>`,
        html`<pre>
Error rendering character: character file is invalid${character
            ? ": " + character.error.message
            : ""}</pre
        >`,
        this.contentEl,
      );
      return;
    } else if (character.isRight()) {
      await this.renderCharacter(character.value, file, false);
    }
  }

  async renderCharacter(
    charCtx: CharacterContext,
    file: TFile,
    readOnly: boolean = false,
  ) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    const tpl = html`
      <article class="iron-vault-character">
        <h3 class="name">${md(this.plugin, lens.name.get(raw), file.path)}</h3>
        ${this.renderStats(charCtx, file)} ${this.renderMeters(charCtx, file)}
        ${this.renderImpacts(charCtx, file, readOnly)}
        ${this.renderAssets(charCtx, file)}
      </article>
    `;
    render(tpl, this.contentEl);
  }

  renderStats(charCtx: CharacterContext, _file: TFile) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    return html`
      <ul class="stats">
        ${map(
          Object.entries(lens.stats),
          ([stat, value]) => html`
            <li>
              <dl>
                <dt data-value=${stat}>${stat}</dt>
                <dd data-value=${value.get(raw)}>${value.get(raw)}</dd>
              </dl>
            </li>
          `,
        )}
      </ul>
    `;
  }

  renderMeters(charCtx: CharacterContext, _file: TFile) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    return html`
      <ul class="meters">
        ${map(
          Object.entries(lens.condition_meters),
          ([meter, value]) => html`
            <li>
              <dl>
                <dt data-value=${meter}>${meter}</dt>
                <dd data-value=${value.get(raw)}>
                  <button type="button">-</button>
                  <span>${value.get(raw)}</span>
                  <button type="button">+</button>
                </dd>
              </dl>
            </li>
          `,
        )}
        <li class="momentum">
          <dl>
            <dt>momentum</dt>
            <dd data-value=${lens.momentum.get(raw)}>
              <button type="button">-</button>
              <span>${lens.momentum.get(raw)}</span>
              <button type="button">+</button>
            </dd>
          </dl>
          <button type="button">Reset</button>
        </li>
      </ul>
    `;
  }

  renderImpacts(charCtx: CharacterContext, _file: TFile, readOnly: boolean) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    const categories: Record<string, Record<string, boolean>> = {};
    for (const [impact, value] of Object.entries(lens.impacts.get(raw))) {
      const category = lens.ruleset.impacts[impact].category.label;
      if (!categories[category]) {
        categories[category] = {};
      }
      categories[category][impact] = value;
    }
    return html`
      <ul class="impact-categories">
        ${map(
          Object.entries(categories),
          ([impact, value]) => html`
            <li>
              <header>${impact}</header>
              <ul class="impacts">
                ${map(
                  Object.entries(value),
                  ([impact, value]) => html`
                    <li>
                      <label>
                        <input
                          name=${impact}
                          type="checkbox"
                          ?checked=${value}
                          ?disabled=${readOnly}
                        />
                        <span>${impact.replaceAll(/_/g, " ")}</span>
                      </label>
                    </li>
                  `,
                )}
              </ul>
            </li>
          `,
        )}
      </ul>
    `;
  }

  renderSpecialTracks(charCtx: CharacterContext, _file: TFile) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    return html`
      <ul class="special-tracks">
        ${map(
          Object.entries(lens.special_tracks),
          ([track, value]) => html`
            <li>
              <dl>
                <dt data-value=${track}>${track}</dt>
                <dd>${JSON.stringify(value.get(raw))}</dd>
              </dl>
            </li>
          `,
        )}
      </ul>
    `;
  }

  renderAssets(charCtx: CharacterContext, _file: TFile) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    return html`
      <ul class="assets">
        ${map(
          Object.values(lens.assets.get(raw)),
          (asset) => html` <li>${renderAssetCard(this.plugin, asset)}</li> `,
        )}
      </ul>
    `;
  }

  // async updateClockProgress(
  //   file: TFile,
  //   { steps, progress }: { steps?: number; progress?: number },
  // ) {
  //   const newProg = await clockUpdater(
  //     vaultProcess(this.plugin.app, file.path),
  //     (clockFile) =>
  //       clockFile.updatingClock((clock) =>
  //         progress != null ? clock.withProgress(progress) : clock.tick(steps!),
  //       ),
  //   );

  //   await this.renderCharacter(newProg, file);
  // }
}
