import ForgedPlugin from "index";
import { App, Editor, MarkdownView, TFolder, stringifyYaml } from "obsidian";
import {
  ForgedPluginSettings,
  advanceClockTemplate,
  advanceProgressTemplate,
  createProgressTemplate,
} from "../settings/ui";
import { vaultProcess } from "../utils/obsidian";
import { CustomSuggestModal } from "../utils/suggest";
import { ClockIndex, clockUpdater } from "./clock-file";
import {
  ProgressIndex,
  ProgressTrack,
  ProgressTrackFileAdapter,
  ProgressTrackSettings,
  progressTrackUpdater,
} from "./progress";
import { ProgressTrackCreateModal } from "./progress-create";
import { selectProgressTrack } from "./select";
import { selectClock } from "./select-clock";

export async function advanceProgressTrack(
  app: App,
  settings: ForgedPluginSettings,
  editor: Editor,
  view: MarkdownView,
  progressIndex: ProgressIndex,
  progressSettings: ProgressTrackSettings,
) {
  // if (!datastore.ready) {
  //   console.warn("data not ready");
  //   return;
  // }
  const [trackPath, trackInfo] = await selectProgressTrack(
    progressIndex,
    app,
    ([, trackInfo]) =>
      !trackInfo.track.complete && trackInfo.track.ticksRemaining > 0,
  );

  const steps = await CustomSuggestModal.select(
    app,
    Array(trackInfo.track.stepsRemaining)
      .fill(0)
      .map((_, i) => i + 1),
    (num) => num.toString(),
    undefined,
    "Select number of times to advance the progress track.",
  );

  const newTrack = await progressTrackUpdater(progressSettings)(
    vaultProcess(app, trackPath),
    (trackAdapter) => {
      return trackAdapter.updatingTrack((track) => track.advanced(steps));
    },
  );

  editor.replaceSelection(
    advanceProgressTemplate(settings)({
      trackInfo: newTrack,
      trackPath,
      steps,
    }),
  );
}

export async function advanceClock(
  app: App,
  settings: ForgedPluginSettings,
  editor: Editor,
  view: MarkdownView,
  clockIndex: ClockIndex,
) {
  // TODO: clearly we should have something like this checking the indexer
  // if (!datastore.ready) {
  //   console.warn("data not ready");
  //   return;
  // }
  const [clockPath, clockInfo] = await selectClock(
    clockIndex,
    app,
    ([, clockInfo]) => clockInfo.clock.active && !clockInfo.clock.isFilled,
  );

  const ticks = await CustomSuggestModal.select(
    app,
    Array(clockInfo.clock.ticksRemaining())
      .fill(0)
      .map((_, i) => i + 1),
    (num) => num.toString(),
    undefined,
    "Select number of segments to fill.",
  );

  const newClock = await clockUpdater(
    vaultProcess(app, clockPath),
    (clockAdapter) => {
      return clockAdapter.updatingClock((clock) => clock.tick(ticks));
    },
  );

  editor.replaceSelection(
    advanceClockTemplate(settings)({
      clockInfo: newClock,
      clockPath: clockPath,
      ticks,
    }),
  );
}

export async function createProgressTrack(
  plugin: ForgedPlugin,
  editor: Editor,
): Promise<void> {
  const trackInput: {
    fileName: string;
    name: string;
    tracktype: string;
    track: ProgressTrack;
  } = await new Promise((onAccept, onReject) => {
    new ProgressTrackCreateModal(plugin.app, onAccept, onReject).open();
  });

  const track = ProgressTrackFileAdapter.newFromTrack(
    trackInput,
    plugin.progressTrackSettings,
  ).expect("invalid track");

  // TODO: where these are created should be configurable
  const progressFolder = plugin.app.vault.getAbstractFileByPath("Progress");
  if (!(progressFolder instanceof TFolder)) {
    throw new Error("Expected 'Progress' to be folder");
  }

  // TODO: figure out the templating for this
  const file = await plugin.app.fileManager.createNewFile(
    progressFolder,
    trackInput.fileName,
    "md",
    `---\n${stringifyYaml(track.raw)}\n---\n\n# ${track.name}\n\n`,
  );

  editor.replaceSelection(
    createProgressTemplate(plugin.settings)({
      trackInfo: track,
      trackPath: file.path,
    }),
  );
}
